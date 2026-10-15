package ee.woodstar.shop.service;

import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.domain.Order;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** Sends the pickup email; logs it instead when no SMTP host is configured. */
@Slf4j
@Service
public class MailService {

    private static final DateTimeFormatter DEADLINE_FMT =
        DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(ZoneId.of("Europe/Tallinn"));

    private final WoodstarProperties props;
    private final JavaMailSender sender;
    private final boolean smtpConfigured;

    public MailService(WoodstarProperties props, ObjectProvider<JavaMailSender> senderProvider,
                       @Value("${spring.mail.host:}") String smtpHost) {
        this.props = props;
        this.smtpConfigured = smtpHost != null && !smtpHost.isBlank();
        this.sender = smtpConfigured ? senderProvider.getIfAvailable() : null;
    }

    public void sendPickupEmail(Order order) {
        String link = props.getPublicBaseUrl() + "/pickup/" + order.getPickupToken();
        String deadline = order.getPickupDeadline() == null ? "-" : DEADLINE_FMT.format(order.getPickupDeadline());
        boolean en = "en".equalsIgnoreCase(order.getLocale());
        String siteName = order.getSite().getName();
        String siteAddress = order.getSite().getAddress();
        String lockerLabel = order.getLocker().getLabel();

        String subject = en
            ? "Puukapp: your firewood is waiting in locker " + lockerLabel
            : "Puukapp: sinu küttepuud ootavad kapis " + lockerLabel;
        String body = en
            ? """
              Thank you for your order %s.

              Product: %s
              Site: %s, %s
              Locker: %s

              Open the locker with this link on your phone when you are at the site:
              %s

              Please pick up by %s.
              """.formatted(order.getOrderNumber(), order.getProductName(), siteName, siteAddress, lockerLabel, link, deadline)
            : """
              Täname tellimuse %s eest.

              Toode: %s
              Asukoht: %s, %s
              Kapp: %s

              Ava kapp kohapeal telefonist selle lingiga:
              %s

              Palun tule järele hiljemalt %s.
              """.formatted(order.getOrderNumber(), order.getProductName(), siteName, siteAddress, lockerLabel, link, deadline);

        if (!smtpConfigured || sender == null) {
            log.info("[mail not configured] To: {}\nSubject: {}\n{}", order.getEmail(), subject, body);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(props.getMail().getFrom());
        msg.setTo(order.getEmail());
        msg.setSubject(subject);
        msg.setText(body);
        try {
            sender.send(msg);
            log.info("Pickup email sent for order {} to {}", order.getOrderNumber(), order.getEmail());
        } catch (Exception e) {
            // Never let a mail failure roll back a paid order; the admin can resend.
            log.error("Failed to send pickup email for order {}: {}", order.getOrderNumber(), e.getMessage());
        }
    }
}

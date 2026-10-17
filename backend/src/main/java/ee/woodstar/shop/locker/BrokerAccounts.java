package ee.woodstar.shop.locker;

/** Port for the MQTT broker's own login list: one login per Shelly device. Implementations must be thread-safe. */
public interface BrokerAccounts {
    /**
     * Creates the device's login (username = device id) or replaces its password; a connected device is
     * disconnected and must reconnect with the new one. Blocks until the broker confirms (≤ 5 s).
     *
     * @throws BrokerException when the broker is unreachable or refuses the change
     */
    void setDeviceLogin(String deviceId, String password);

    /** Removes the device's login and disconnects it. Removing a login that does not exist is not an error. */
    void deleteDeviceLogin(String deviceId);

    /** False when doors are mocked (MQTT off): logins are accepted but no broker enforces them. */
    boolean isLive();

    class BrokerException extends RuntimeException {
        public BrokerException(String message) { super(message); }
    }
}

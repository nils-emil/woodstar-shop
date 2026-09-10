# Build stage: glibc-based JDK image (Gradle's native file watcher crashes on musl/aarch64).
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app
COPY gradlew .
COPY gradle gradle
COPY build.gradle settings.gradle ./
RUN ./gradlew dependencies --no-daemon -q || true
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test \
    && java -Djarmode=tools -jar build/libs/*.jar extract --layers --launcher --destination extracted

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S woodstar && adduser -S woodstar -G woodstar
COPY --from=builder --chown=woodstar:woodstar /app/extracted/dependencies/ ./
COPY --from=builder --chown=woodstar:woodstar /app/extracted/spring-boot-loader/ ./
COPY --from=builder --chown=woodstar:woodstar /app/extracted/snapshot-dependencies/ ./
COPY --from=builder --chown=woodstar:woodstar /app/extracted/application/ ./
USER woodstar
EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]

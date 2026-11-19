# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY backend/pom.xml ./pom.xml
RUN --mount=type=cache,target=/root/.m2 mvn -B dependency:go-offline
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 fluffy \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin fluffy \
    && mkdir -p /app/media \
    && chown -R 10001:10001 /app
WORKDIR /app
COPY --from=build --chown=10001:10001 /workspace/target/fluffy-memory-0.1.0-SNAPSHOT.jar ./app.jar
ENV APP_MEDIA_DIRECTORY=/app/media JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70.0 -XX:+ExitOnOutOfMemoryError"
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=5 \
    CMD curl --fail --silent http://127.0.0.1:8080/actuator/health > /dev/null || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

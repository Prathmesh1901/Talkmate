# ----- STAGE 1: Build -----
FROM maven:3.9.6-eclipse-temurin-17 as builder

WORKDIR /app

# Copy source code
COPY . .

# Build the application (this creates the JAR file)
RUN mvn clean package -DskipTests

# ----- STAGE 2: Run -----
FROM openjdk:17-jdk-slim

WORKDIR /app

# Copy JAR from the build stage
COPY --from=builder /app/target/chat-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]

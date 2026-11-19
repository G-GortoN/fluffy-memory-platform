package dev.fluffymemory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FluffyMemoryApplication {
    public static void main(String[] args) {
        SpringApplication.run(FluffyMemoryApplication.class, args);
    }
}

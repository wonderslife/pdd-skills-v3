# Java Project Template for PDD

## Technology Stack

- Java 17+
- Maven / Gradle
- Spring Boot (optional)
- MyBatis / JPA (optional)

## PDD Configuration for Java Projects

The following linters are recommended:

- **Checkstyle**: Code style enforcement
- **PMD**: Code quality analysis
- **SpotBugs**: Bug pattern detection

## Directory Structure

```
java-project/
├── src/main/java/com/example/
│   ├── controller/
│   ├── service/
│   ├── repository/
│   ├── entity/
│   └── util/
├── src/test/java/
├── src/main/resources/
│   ├── mapper/
│   └── application.yml
├── config/
│   ├── checkstyle.xml
│   └── pmd.xml
└── pom.xml or build.gradle
```

## Integration with PDD

```bash
# Initialize with Java template
pdd init . -t java

# Run Java-specific linters
pdd linter -t code

# The linter will automatically use checkstyle.xml and pmd.xml
```

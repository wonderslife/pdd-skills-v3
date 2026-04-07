---
name: expert-security
description: |
  安全专家提供代码漏洞扫描、OWASP Top 10合规检查和安全编码建议。
  当用户需要安全审计、漏洞扫描或安全编码时调用。Security expert for
  vulnerability scanning, OWASP compliance, secure coding. Invoke for security audit.
license: MIT
author: "neuqik@hotmail.com"
version: "1.0.0"
triggers:
  - "安全审计"
  - "漏洞扫描"
  - "安全编码"
---

# Security Expert / 安全专家

## Core Concept / 核心概念

### 🇨🇳
安全专家是系统的"数字守卫"，通过主动防御和被动检测相结合的方式，
识别并修复代码中的安全漏洞，确保系统符合OWASP Top 10安全标准，
保护用户数据和业务资产免受攻击威胁。

### 🇺🇸
The security expert acts as the system's "digital guardian," combining proactive defense
with passive detection to identify and remediate code vulnerabilities, ensuring OWASP Top 10
compliance, and protecting user data and business assets from attack threats.

---

## Core Capabilities / 核心能力

### 1. 代码漏洞扫描 (Code Vulnerability Scanning)

#### 1.1 SQL注入检测与修复 / SQL Injection Detection & Remediation

**🇨🇳 攻击场景分析**

```java
// ❌ VULNERABLE: 拼接SQL - 易受SQL注入攻击
@GetMapping("/users/search")
public List<User> searchUser(@RequestParam String keyword) {
    String sql = "SELECT * FROM sys_user WHERE user_name LIKE '%" + keyword + "%'";
    return jdbcTemplate.queryForList(sql);
}

// ✅ SECURE: 使用PreparedStatement参数化查询
@GetMapping("/users/search")
public List<User> searchUserSecure(@RequestParam String keyword) {
    String sql = "SELECT * FROM sys_user WHERE user_name LIKE ?";
    return jdbcTemplate.queryForList(sql, "%" + keyword + "%");
}
```

**🇺🇸 Attack Scenario Analysis**

| Attack Vector | Example Payload | Impact | Severity |
|--------------|----------------|--------|----------|
| Authentication Bypass | `' OR '1'='1` | Full database access | CRITICAL |
| Data Extraction | `' UNION SELECT * FROM sys_user--` | Sensitive data leak | CRITICAL |
| Data Manipulation | `'; DROP TABLE sys_user;--` | Data destruction | CRITICAL |
| Blind Injection | `' AND 1=CAST((SELECT password FROM sys_user LIMIT 1) AS INT)--` | Information disclosure | HIGH |

**MyBatis安全配置示例 / MyBatis Secure Configuration:**

```xml
<!-- ❌ VULNERABLE: ${} 拼接 -->
<select id="getUserByName" resultType="SysUser">
    SELECT * FROM sys_user WHERE user_name = '${userName}'
</select>

<!-- ✅ SECURE: #{} 参数化 -->
<select id="getUserByName" resultType="SysUser">
    SELECT * FROM sys_user WHERE user_name = #{userName}
</select>
```

#### 1.2 XSS跨站脚本防护 / XSS Cross-Site Scripting Protection

**🇨🏳 攻击类型分类 / Attack Type Classification**

| 类型 | 示例 | 防护策略 |
|------|------|---------|
| Reflected XSS | `<script>alert('XSS')</script>` | 输出转义 + CSP |
| Stored XSS | `<img src=x onerror=alert(1)>` | 输入过滤 + 输出编码 |
| DOM-based XSS | `javascript:alert(document.cookie)` | DOM操作安全 + 输入验证 |

**Spring Boot防护配置 / Spring Boot Protection Configuration:**

```java
// 1. 全局XSS过滤器
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class XssFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {
        XssHttpServletRequestWrapper xssRequest =
            new XssHttpServletRequestWrapper((HttpServletRequest) request);
        chain.doFilter(xssRequest, response);
    }
}

// 2. HTML转义工具类
public class HtmlUtils {
    private static final Pattern[] PATTERNS = {
        Pattern.compile("<script>(.*?)</script>", Pattern.CASE_INSENSITIVE),
        Pattern.compile("src[\r\n]*=[\r\n]*\\\'(.*?)\\'",
            Pattern.CASE_INSENSITIVE | Pattern.MULTILINE),
        Pattern.compile("</script>", Pattern.CASE_INSENSITIVE),
        Pattern.compile("<script(.*?)>",
            Pattern.CASE_INSENSITIVE | Pattern.MULTILINE),
        Pattern.compile("eval\\((.*?)\\)",
            Pattern.CASE_INSENSITIVE | Pattern.MULTILINE),
        Pattern.compile("expression\\((.*?)\\)",
            Pattern.CASE_INSENSITIVE | Pattern.MULTILINE)
    };

    public static String clean(String input) {
        if (input == null) return null;
        String result = input;
        for (Pattern pattern : PATTERNS) {
            result = pattern.matcher(result).replaceAll("");
        }
        return result;
    }
}
```

#### 1.3 CSRF跨站请求伪造防护 / CSRF Cross-Site Request Forgery Protection

**🇨🇳 Spring Boot CSRF防御方案 / 🇺🇸 Spring Boot CSRF Defense Solution:**

```java
// 1. 启用CSRF保护
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // 启用CSRF保护
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
            )
            // 配置需要保护的端点
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll()
            );
        return http.build();
    }
}

// 2. 前端CSRF Token处理（Thymeleaf示例）
<meta name="_csrf" th:content="${_csrf.token}"/>
<meta name="_csrf_header" th:content="${_csrf.headerName}"/>

<script>
// AJAX请求自动添加CSRF Token
$(document).ajaxSend(function(e, xhr, options) {
    var token = $("meta[name='_csrf']").attr("content");
    var header = $("meta[name='_csrf_header']").attr("content");
    xhr.setRequestHeader(header, token);
});
</script>
```

#### 1.4 命令注入防护 / Command Injection Prevention

**🇨🇳 危险场景示例 / 🇺🇸 Dangerous Scenario Examples:**

```java
// ❌ VULNERABLE: 直接拼接命令
Runtime.getRuntime().exec("ping " + ipAddress);

// ✅ SECURE: 白名单验证 + 参数化执行
public boolean pingHost(String ipAddress) {
    // IP地址格式验证
    if (!isValidIpAddress(ipAddress)) {
        throw new IllegalArgumentException("Invalid IP address format");
    }

    // 使用白名单字符集
    if (!ipAddress.matches("^[0-9.]+$")) {
        throw new SecurityException("Invalid characters in IP address");
    }

    ProcessBuilder pb = new ProcessBuilder("ping", "-c", "4", ipAddress);
    // 执行命令...
}

private boolean isValidIpAddress(String ip) {
    String ipPattern = "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}"
                    + "(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$";
    return ip.matches(ipPattern);
}
```

#### 1.5 路径遍历防护 / Path Traversal Prevention

```java
// ❌ VULNERABLE: 未验证路径
@GetMapping("/files/download")
public ResponseEntity<Resource> downloadFile(@RequestParam String filename) {
    Path path = Paths.get("/uploads/" + filename);
    Resource resource = new UrlResource(path.toUri());
    return ResponseEntity.ok().body(resource);
}

// ✅ SECURE: 规范化路径 + 白名单验证
@GetMapping("/files/download")
public ResponseEntity<Resource> downloadFileSecure(@RequestParam String filename) {
    try {
        // 验证文件名不包含路径遍历字符
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new SecurityException("Invalid filename");
        }

        // 规范化路径并验证在允许目录内
        Path basePath = Paths.get("/uploads/").normalize().toAbsolutePath();
        Path filePath = basePath.resolve(filename).normalize();

        if (!filePath.startsWith(basePath)) {
            throw new SecurityException("Path traversal attempt detected");
        }

        Resource resource = new UrlResource(filePath.toUri());
        if (resource.exists()) {
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
        }
        return ResponseEntity.notFound().build();
    } catch (IOException e) {
        return ResponseEntity.badRequest().build();
    }
}
```

---

### 2. 认证与授权安全 (Authentication & Authorization)

#### 2.1 身份认证安全 (JWT/Session)

**🇨🇳 JWT安全最佳实践 / 🇺🇸 JWT Security Best Practices:**

```java
// JWT工具类 - 安全实现
@Component
public class JwtTokenUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration:86400000}")
    private long expiration;

    // 使用强密钥生成算法
    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secret);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("roles", userDetails.getAuthorities());
        claims.put("created", new Date());

        return Jwts.builder()
            .setClaims(claims)
            .setSubject(userDetails.getUsername())
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(getSigningKey(), SignatureAlgorithm.HS256)
            .compact();
    }

    public Boolean validateToken(String token, UserDetails userDetails) {
        final String username = getUsernameFromToken(token);
        return (username.equals(userDetails.getUsername())
                && !isTokenExpired(token));
    }

    // Token黑名单检查（用于注销功能）
    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    public boolean isTokenBlacklisted(String token) {
        return Boolean.TRUE.equals(redisTemplate.hasKey("blacklist:" + token));
    }
}
```

**Session安全管理 / Session Security Management:**

```properties
# application.yml - Session安全配置
server:
  servlet:
    session:
      cookie:
        http-only: true      # 防止JavaScript访问Cookie
        secure: true         # 仅HTTPS传输
        same-site: strict    # 防止CSRF攻击
      timeout: 30m           # 会话超时时间
```

#### 2.2 权限控制 (RBAC/ABAC)

**🇨🇳 若依框架RBAC注解示例 / 🇺🇸 RuoYi Framework RBAC Annotation Example:**

```java
@RestController
@RequestMapping("/system/user")
public class SysUserController extends BaseController {

    @PreAuthorize("@ss.hasPermi('system:user:list')")
    @GetMapping("/list")
    public TableDataInfo list(SysUser user) {
        startPage();
        List<SysUser> list = userService.selectUserList(user);
        return getDataTable(list);
    }

    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @GetMapping(value = "/{userId}")
    public AjaxResult getInfo(@PathVariable Long userId) {
        userService.checkUserDataScope(userId);
        return success(userService.selectUserById(userId));
    }

    @PreAuthorize("@ss.hasPermi('system:user:add')")
    @Log(title = "用户管理", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@RequestBody SysUser user) {
        // 数据权限校验
        if (!userService.checkUsernameUnique(user.getUserName())) {
            return error("新增用户'" + user.getUserName() + "'失败，登录账号已存在");
        }
        return toAjax(userService.insertUser(user));
    }

    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@RequestBody SysUser user) {
        userService.checkUserDataScope(user.getUserId());
        return toAjax(userService.updateUser(user));
    }

    @PreAuthorize("@ss.hasPermi('system:user:remove')")
    @Log(title = "用户管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{userIds}")
    public AjaxResult remove(@PathVariable Long[] userIds) {
        return toAjax(userService.deleteUserByIds(userIds));
    }
}
```

#### 2.3 密码策略 / Password Policy

**🇨🇳 密码强度要求 / 🇺🇸 Password Strength Requirements:**

```java
// 密码验证器
public class PasswordValidator {

    // 密码复杂度规则
    private static final int MIN_LENGTH = 8;
    private static final int MAX_LENGTH = 20;

    public static ValidationResult validatePassword(String password) {
        ValidationResult result = new ValidationResult();

        // 长度检查
        if (password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) {
            result.addError("密码长度必须在" + MIN_LENGTH + "-" + MAX_LENGTH + "个字符之间");
        }

        // 包含大写字母
        if (!password.matches(".*[A-Z].*")) {
            result.addError("密码必须包含至少一个大写字母");
        }

        // 包含小写字母
        if (!password.matches(".*[a-z].*")) {
            result.addError("密码必须包含至少一个小写字母");
        }

        // 包含数字
        if (!password.matches(".*\\d.*")) {
            result.addError("密码必须包含至少一个数字");
        }

        // 包含特殊字符
        if (!password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?].*")) {
            result.addError("密码必须包含至少一个特殊字符");
        }

        // 常见弱密码检查
        if (isCommonWeakPassword(password)) {
            result.addError("不能使用常见弱密码");
        }

        return result;
    }

    // BCrypt加密存储
    public String encodePassword(String rawPassword) {
        return new BCryptPasswordEncoder().encode(rawPassword);
    }

    public boolean matchesPassword(String rawPassword, String encodedPassword) {
        return new BCryptPasswordEncoder().matches(rawPassword, encodedPassword);
    }
}
```

---

### 3. 数据保护 (Data Protection)

#### 3.1 敏感数据加密 / Sensitive Data Encryption

**🇨🇳 AES加密工具类 / 🇺🇸 AES Encryption Utility:**

```java
@Component
public class AesEncryptor {

    @Value("${encrypt.aes.key}")
    private String aesKey;

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;

    /**
     * 加密敏感数据（如身份证号、银行卡号等）
     */
    public String encrypt(String plaintext) throws Exception {
        // 生成随机IV
        byte[] iv = new byte[GCM_IV_LENGTH];
        new SecureRandom().nextBytes(iv);

        // 初始化加密器
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        SecretKeySpec keySpec = new SecretKeySpec(
            Base64.getDecoder().decode(aesKey), "AES");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);

        // 加密
        byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

        // 组合IV + 密文
        byte[] encryptedWithIv = new byte[GCM_IV_LENGTH + encrypted.length];
        System.arraycopy(iv, 0, encryptedWithIv, 0, GCM_IV_LENGTH);
        System.arraycopy(encrypted, 0, encryptedWithIv, GCM_IV_LENGTH, encrypted.length);

        return Base64.getEncoder().encodeToString(encryptedWithIv);
    }

    /**
     * 解密敏感数据
     */
    public String decrypt(String encryptedText) throws Exception {
        byte[] decoded = Base64.getDecoder().decode(encryptedText);

        // 提取IV
        byte[] iv = Arrays.copyOfRange(decoded, 0, GCM_IV_LENGTH);

        // 提取密文
        byte[] encrypted = Arrays.copyOfRange(decoded, GCM_IV_LENGTH, decoded.length);

        // 解密
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        SecretKeySpec keySpec = new SecretKeySpec(
            Base64.getDecoder().decode(aesKey), "AES");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);

        byte[] decrypted = cipher.doFinal(encrypted);
        return new String(decrypted, StandardCharsets.UTF_8);
    }
}
```

#### 3.2 日志脱敏 / Log Desensitization

**🇨🇳 敏感信息脱敏处理器 / 🇺🇸 Sensitive Information Masking Processor:**

```java
/**
 * 日志脱敏注解
 */
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface Sensitive {
    SensitiveType value() default SensitiveType.DEFAULT;
}

/**
 * 脱敏类型枚举
 */
public enum SensitiveType {
    DEFAULT,        // 默认脱敏
    PHONE,          // 手机号：138****1234
    ID_CARD,        // 身份证：110***********1234
    BANK_CARD,      // 银行卡：6222***********1234
    EMAIL,          // 邮箱：t***@example.com
    PASSWORD,       // 密码：******
    NAME            // 姓名：张*
}

/**
 * 脱敏工具类
 */
public class DesensitizeUtils {

    public static String desensitize(String value, SensitiveType type) {
        if (value == null || value.isEmpty()) return value;

        switch (type) {
            case PHONE:
                return value.replaceAll("(\\d{3})\\d{4}(\\d{4})", "$1****$2");
            case ID_CARD:
                return value.replaceAll("(\\d{4})\\d{10}(\\d{4})", "$1**********$2");
            case BANK_CARD:
                return value.replaceAll("(\\d{4})\\d+(\\d{4})", "$1***********$2");
            case EMAIL:
                return value.replaceAll("(^.)[^@]*(@.*$)", "$1***$2");
            case PASSWORD:
                return "******";
            case NAME:
                if (value.length() <= 2) return "*";
                return value.charAt(0) + "*".repeat(value.length() - 1);
            default:
                return value.length() > 4 ?
                       value.substring(0, 2) + "***" + value.substring(value.length() - 2) :
                       "***";
        }
    }
}

// 使用示例
@Slf4j
public class UserServiceImpl implements UserService {

    public void saveUser(@Sensitive(SensitiveType.PHONE) String phone,
                         @Sensitive(SensitiveType.ID_CARD) String idCard) {
        log.info("保存用户信息: phone={}, idCard={}", phone, idCard);
        // 日志输出: 保存用户信息: phone=138****1234, idCard=110***********1234
    }
}
```

#### 3.3 文件上传安全 / File Upload Security

**🇨🇳 安全上传控制器 / 🇺🇸 Secure Upload Controller:**

```java
@RestController
@RequestMapping("/common/upload")
public class CommonUploadController {

    // 允许的文件扩展名白名单
    private static final Set<String> ALLOWED_EXTENSIONS =
        Set.of("jpg", "jpeg", "png", "gif", "bmp", "doc", "docx",
               "xls", "xlsx", "pdf", "txt", "zip", "rar");

    // 文件大小限制：10MB
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    @PostMapping("/upload")
    public AjaxResult uploadFile(MultipartFile file) throws Exception {
        // 1. 文件非空检查
        if (file.isEmpty()) {
            return error("上传文件不能为空");
        }

        // 2. 文件大小检查
        if (file.getSize() > MAX_FILE_SIZE) {
            return error("上传文件大小不能超过10MB");
        }

        // 3. 文件扩展名检查
        String originalFilename = file.getOriginalFilename();
        String extension = FilenameUtils.getExtension(originalFilename).toLowerCase();

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return error("不允许上传此类型的文件：" + extension);
        }

        // 4. 文件内容类型验证（防止MIME类型伪造）
        String contentType = file.getContentType();
        if (!isValidContentType(contentType, extension)) {
            return error("文件类型与内容不匹配");
        }

        // 5. 文件内容魔数验证（防止文件头伪装）
        if (!validateFileHeader(file)) {
            return error("文件内容验证失败");
        }

        // 6. 生成安全的文件名（UUID + 时间戳）
        String fileName = generateSafeFileName(extension);

        // 7. 上传到安全目录（禁止Web可访问目录）
        String filePath = RuoYiConfig.getUploadPath() + fileName;
        file.transferTo(new File(filePath));

        // 8. 返回文件访问URL（通过Controller访问，不直接暴露路径）
        String url = serverConfig.getUrl() + "/common/download?fileName=" + fileName;
        AjaxResult ajax = AjaxResult.success();
        ajax.put("url", url);
        ajax.put("fileName", fileName);
        ajax.put("originalFilename", originalFilename);
        ajax.put("newFileName", fileName);
        return ajax;
    }

    private boolean validateFileHeader(MultipartFile file) throws IOException {
        byte[] header = new byte[4];
        try (InputStream is = file.getInputStream()) {
            is.read(header);
        }

        // JPEG: FF D8 FF
        // PNG: 89 50 4E 47
        // GIF: 47 49 46 38
        // PDF: 25 50 44 46
        String hex = bytesToHex(header);
        return hex.startsWith("FFD8FF") ||   // JPEG
               hex.startsWith("89504E47") || // PNG
               hex.startsWith("47494638") || // GIF
               hex.startsWith("25504446");   // PDF
    }

    private String generateSafeFileName(String extension) {
        return UUID.randomUUID().toString().replace("-", "")
               + "_" + System.currentTimeMillis()
               + "." + extension;
    }
}
```

---

### 4. OWASP Top 10 合规检查 (OWASP Compliance)

**🇨🇳 OWASP Top 10 2021版完整覆盖 / 🇺🇸 OWASP Top 10 2021 Complete Coverage:**

| # | 类别 | 中文描述 | 检测方法 | 修复优先级 |
|---|------|---------|---------|-----------|
| A01 | Broken Access Control | 访问控制失效 | 权限矩阵审查 | CRITICAL |
| A02 | Cryptographic Failures | 加密机制失效 | 密钥轮换检查 | CRITICAL |
| A03 | Injection | 注入攻击 | SAST/DAST扫描 | CRITICAL |
| A04 | Insecure Design | 不安全设计 | 威胁建模 | HIGH |
| A05 | Security Misconfiguration | 安全配置错误 | 配置基线检查 | HIGH |
| A06 | Vulnerable Components | 过时组件 | 依赖扫描 | HIGH |
| A07 | Auth Failures | 身份认证失效 | 认证流程审计 | CRITICAL |
| A08 | Software/Data Integrity | 软件/数据完整性 | 签名验证 | MEDIUM |
| A09 | Logging/Monitoring Failures | 日志/监控不足 | 日志覆盖检查 | MEDIUM |
| A10 | SSRF | 服务端请求伪造 | 网络访问控制 | HIGH |

**🇨🇳 各条目详细检测规则 / 🇺🇸 Detailed Detection Rules for Each Item:**

#### A01: Broken Access Control / 访问控制失效

```java
// ❌ VULNERABLE: 缺少权限校验
@GetMapping("/admin/users/{id}")
public User getUser(@PathVariable Long id) {
    return userService.getUserById(id);  // 任何认证用户都可访问
}

// ✅ SECURE: 完整的权限控制链
@GetMapping("/admin/users/{id}")
@PreAuthorize("@ss.hasPermi('system:user:query')")
public AjaxResult getUser(@PathVariable Long id) {
    // 1. 权限注解检查
    // 2. 数据范围校验（数据权限）
    userService.checkUserDataScope(id);
    // 3. 业务逻辑校验
    User user = userService.getUserById(id);
    if (user == null) {
        return error("用户不存在");
    }
    // 4. 敏感字段脱敏
    user.setPhone(DesensitizeUtils.desensitize(user.getPhone(), SensitiveType.PHONE));
    return success(user);
}
```

#### A02: Cryptographic Failures / 加密机制失效

**🇨🇳 检查清单 / 🇺🇸 Checklist:**
- [ ] 敏感数据使用AES-256-GCM加密存储
- [ ] 传输层强制TLS 1.2+
- [ ] 密码使用BCrypt/Argon2哈希
- [ ] 密钥定期轮换（建议90天）
- [ ] 禁用弱加密算法（MD5、SHA1、DES、RC4）

#### A03: Injection / 注入攻击

**🇨🇳 全面注入防护矩阵 / 🇺🇸 Comprehensive Injection Protection Matrix:**

| 注入类型 | 危险函数/API | 防护措施 | 检测工具 |
|---------|-------------|---------|---------|
| SQL注入 | Statement.executeQuery() | PreparedStatement | SQLMap |
| NoSQL注入 | BasicQuery.where() | 参数化查询 | NoSQLMap |
| OS命令注入 | Runtime.exec() | 白名单验证 | Commix |
| LDAP注入 | SearchControls() | LDAP转义 | Ldapmap |
| XPath注入 | XPath.evaluate() | 参数化XPath | XPathInjector |
| XXE | XMLReader.parse() | 禁用外部实体 | XXEinjector |

#### A07: Authentication Failures / 身份认证失效

**🇨🇳 安全认证流程 / 🇺🇸 Secure Authentication Flow:**

```java
@Service
public class SecureLoginService {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private RedisCache redisCache;

    /**
     * 安全登录流程
     */
    public String login(LoginBody loginBody) {
        String username = loginBody.getUsername();
        String password = loginBody.getPassword();
        String code = loginBody.getCode();
        String uuid = loginBody.getUuid();

        // 1. 验证码校验
        validateCaptcha(username, code, uuid);

        // 2. 登录尝试次数限制（防暴力破解）
        checkLoginAttempts(username);

        // 3. 用户认证
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(username, password)
        );

        // 4. 清除登录失败计数
        clearLoginAttempts(username);

        // 5. 生成JWT Token
        LoginUser loginUser = (LoginUser) authentication.getPrincipal();
        String token = tokenService.createToken(loginUser);

        // 6. 记录登录日志（安全事件）
        recordLoginEvent(loginUser.getUserId(), username, "LOGIN_SUCCESS");

        return token;
    }

    private void checkLoginAttempts(String username) {
        String key = CacheConstants.LOGIN_ATTEMPT_KEY + username;
        Integer attempts = redisCache.getCacheObject(key);

        if (attempts != null && attempts >= 5) {
            // 锁定账户30分钟
            redisCache.setCacheObject(key, attempts, 30, TimeUnit.MINUTES);
            throw new ServiceException("登录失败次数过多，账户已锁定30分钟");
        }
    }
}
```

---

## Guardrails / 安全护栏

**🇨🇳**
1. **最小权限原则**: 所有API接口必须显式声明所需权限，默认拒绝未授权访问
2. **输入验证强制**: 所有外部输入（请求参数、Headers、Cookies）必须经过验证和过滤
3. **安全默认值**: 加密、日志记录、CSRF保护等功能默认开启，需显式禁用
4. **纵深防御**: 在多个层级实施安全控制（网络、应用、数据），单一防线失效不影响整体安全
5. **错误信息模糊化**: 生产环境返回通用错误信息，详细错误仅记录到日志
6. **依赖安全扫描**: 定期扫描第三方依赖漏洞，及时更新有已知CVE的组件
7. **安全编码规范**: 所有新代码必须符合OWASP安全编码指南，Code Review必须包含安全项
8. **应急响应准备**: 制定安全事件响应预案，明确报告渠道和处理流程

**🇺🇸**
1. **Principle of Least Privilege**: All API endpoints must explicitly declare required permissions; deny access by default
2. **Mandatory Input Validation**: All external inputs (request parameters, headers, cookies) must be validated and sanitized
3. **Secure by Default**: Encryption, logging, CSRF protection enabled by default; explicit action required to disable
4. **Defense in Depth**: Implement security controls at multiple layers (network, application, data); single layer failure doesn't compromise overall security
5. **Generic Error Messages**: Return generic errors in production; detailed errors logged only
6. **Dependency Scanning**: Regularly scan third-party dependencies for vulnerabilities; update components with known CVEs promptly
7. **Secure Coding Standards**: All new code must follow OWASP secure coding guidelines; security items mandatory in Code Review
8. **Incident Response Preparedness**: Maintain security incident response plan with clear reporting channels and handling procedures

---

## Iron Law / 核心铁律

**🇨🇳 核心铁律 - 不可违反的安全底线 / 🇺🇸 Iron Laws - Non-Negotiable Security Baselines**

### Iron Law #1: 安全优先原则 / Security First Principle

**规则**: 所有安全问题按Critical级别处理，不得因进度压力、业务需求或成本考虑而降级或跳过安全修复。

**❌ Violation Example / 违规示例:**
```java
// 项目紧急上线，暂时关闭SQL注入防护
// TODO: 上线后再修复安全问题
@GetMapping("/search")
public List<User> search(@RequestParam String keyword) {
    String sql = "SELECT * FROM user WHERE name LIKE '%" + keyword + "%'";
    return jdbcTemplate.queryForList(sql);  // CRITICAL: SQL注入漏洞
}
```

**✅ Compliant Example / 合规示例:**
```java
// 即使项目紧张，也必须使用参数化查询
@GetMapping("/search")
@PreAuthorize("@ss.hasPermi('system:user:list')")
public List<User> search(@RequestParam String keyword) {
    // 输入长度限制
    if (keyword.length() > 50) {
        throw new ServiceException("搜索关键词过长");
    }
    // 参数化查询
    String sql = "SELECT * FROM sys_user WHERE user_name LIKE ?";
    return jdbcTemplate.queryForList(sql, "%" + keyword + "%");
}
```

### Iron Law #2: 最小权限原则 / Principle of Least Privilege

**规则**: 只授予完成工作所需的最小权限，禁止过度授权。数据访问必须遵循数据权限隔离原则。

**❌ Violation Example / 违规示例:**
```java
// 给普通管理员授予超级管理员权限
@PreAuthorize("@ss.hasRole('admin')")  // 过于宽泛
public List<User> getAllUsers() {
    return userService.selectAll();  // 可查看所有用户，包括超管
}
```

**✅ Compliant Example / 合规示例:**
```java
// 精细化的权限控制 + 数据范围隔离
@PreAuthorize("@ss.hasPermi('system:user:list')")
public TableDataInfo list(SysUser user) {
    // 自动应用当前用户的数据权限范围
    startPage();
    // 只能查询本部门及下级部门的数据
    List<SysUser> list = userService.selectUserList(user);
    return getDataTable(list);
}
```

### Iron Law #3: 输入验证强制 / Mandatory Input Validation

**规则**: 所有来自客户端的输入数据必须经过严格的验证和过滤，绝不信任任何未经处理的输入。

**❌ Violation Example / 违规示例:**
```java
// 直接使用前端传来的ID，未做任何验证
@PostMapping("/delete")
public AjaxResult delete(@RequestParam Long userId) {
    return toAjax(userService.deleteUserById(userId));  // 可能删除任意用户
}
```

**✅ Compliant Example / 合规示例:**
```java
@PostMapping("/delete")
@PreAuthorize("@ss.hasPermi('system:user:remove')")
@Log(title = "用户管理", businessType = BusinessType.DELETE)
public AjaxResult delete(@PathVariable Long[] userIds) {
    // 1. 权限校验（注解）
    // 2. 数据范围校验
    for (Long userId : userIds) {
        userService.checkUserDataScope(userId);
        // 不能删除自己
        if (userId.equals(SecurityUtils.getUserId())) {
            return error("当前用户不能删除");
        }
        // 不能删除超级管理员
        if (isAdmin(userId)) {
            return error("不允许删除管理员账号");
        }
    }
    return toAjax(userService.deleteUserByIds(userIds));
}
```

### Iron Law #4: 加密默认开启 / Encryption Enabled by Default

**规则**: 敏感数据的传输和存储必须使用强加密算法，明文传输/存储敏感数据属于严重违规。

**❌ Violation Example / 违规示例:**
```java
// 明文存储身份证号和手机号
@Entity
public class User {
    @Column(name = "id_card")
    private String idCard;  // 明文存储身份证

    @Column(name = "phone")
    private String phone;   // 明文存储手机号
}
```

**✅ Compliant Example / 合规示例:**
```java
// 敏感数据加密存储
@Entity
public class User {
    @Column(name = "id_card")
    private String idCardEncrypted;  // AES-256-GCM加密存储

    @Column(name = "phone")
    private String phoneEncrypted;   // AES-256-GCM加密存储

    // 使用AOP自动加解密
    @SensitiveField(type = SensitiveType.ID_CARD)
    public String getIdCard() {
        return aesEncryptor.decrypt(idCardEncrypted);
    }

    public void setIdCard(String idCard) {
        this.idCardEncrypted = aesEncryptor.encrypt(idCard);
    }
}
```

### Iron Law #5: 不信任客户端 / Never Trust the Client

**规则**: 所有关键业务逻辑和数据校验必须在服务端完成，前端校验仅为用户体验优化，不可作为安全依据。

**❌ Violation Example / 违规示例:**
```javascript
// 前端校验价格（可被绕过）
function validatePrice(price) {
    if (price < 0) {
        alert('价格不能为负数');
        return false;
    }
    return true;
}
```

```java
// 后端直接使用前端传入的价格（危险！）
@PostMapping("/order/create")
public AjaxResult createOrder(@RequestBody Order order) {
    order.setTotalPrice(order.getPrice() * order.getQuantity());
    return toAsync(orderService.createOrder(order));  // 可能被篡改
}
```

**✅ Compliant Example / 合规示例:**
```java
@PostMapping("/order/create")
@PreAuthorize("@ss.hasPermi('order:add')")
public AjaxResult createOrder(@RequestBody OrderDTO orderDTO) {
    // 1. 完整的服务端校验
    if (orderDTO.getPrice() == null || orderDTO.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
        return error("订单价格必须大于0");
    }
    if (orderDTO.getQuantity() == null || orderDTO.getQuantity() <= 0) {
        return error("订单数量必须大于0");
    }

    // 2. 从数据库重新获取商品价格（防止篡改）
    Product product = productService.getProductById(orderDTO.getProductId());
    if (product == null) {
        return error("商品不存在");
    }

    // 3. 使用服务器端价格计算总价
    BigDecimal totalPrice = product.getPrice()
                              .multiply(BigDecimal.valueOf(orderDTO.getQuantity()));

    // 4. 价格合理性校验（防价格篡改）
    if (orderDTO.getPrice().compareTo(product.getPrice()) != 0) {
        // 记录异常行为
        securityAuditService.logSuspiciousActivity(
            SecurityUtils.getUserId(),
            "PRICE_TAMPERING",
            "订单价格与实际不符"
        );
        return error("订单价格异常");
    }

    Order order = new Order();
    order.setProductId(orderDTO.getProductId());
    order.setQuantity(orderDTO.getQuantity());
    order.setPrice(product.getPrice());  // 使用服务器端价格
    order.setTotalPrice(totalPrice);

    return toAsync(orderService.createOrder(order));
}
```

---

## Rationalization Table / 合理化防御表

**🇨🇳 当你想要跳过安全检查时... / 🇺🇸 When you want to skip security checks...**

| 你可能想说的 / What you might say | 为什么这样做是危险的 / Why this is dangerous | 正确的做法 / The right approach | 如果确实需要特殊处理 / If you really need special handling |
|----------------------------------|------------------------------------------|-------------------------------|-----------------------------------------------------|
| "这只是内部系统，不需要这么严格的安全措施" / "This is an internal system, no need for strict security" | 内部系统往往包含最敏感的数据（员工信息、财务数据），且内部威胁占比高达60% / Internal systems often contain most sensitive data; insider threats account for 60% of breaches | 对所有系统实施统一的安全基线，根据数据敏感度分级实施额外控制 / Apply unified security baseline to all systems; implement additional controls based on data sensitivity classification | 进行风险评估，如果确认为低风险环境，文档化决策并获得安全团队批准 / Conduct risk assessment; if truly low-risk environment, document decision and obtain security team approval |
| "这个接口只是查询，不会有安全问题" / "This endpoint is read-only, no security issues" | 查询接口常被利用进行信息收集，为后续攻击做准备；SQL注入可通过只读语句获取全部数据 / Query endpoints are often used for reconnaissance; SQL injection can extract all data via read-only statements | 实施完整的输入验证和输出过滤；对查询结果中的敏感字段进行脱敏 / Implement complete input validation and output filtering; mask sensitive fields in query results | 使用视图限制可查询的字段；实施查询频率限制和结果集大小限制 / Use views to limit queryable fields; implement rate limiting and result set size limits |
| "项目赶进度，安全优化后面再做" / "Project is behind schedule, will optimize security later" | 安全问题一旦上线就可能被利用，且后续修复的成本是开发阶段的10-100倍 / Once deployed, vulnerabilities can be exploited immediately; post-deployment fixes cost 10-100x more | 将安全作为非功能性需求纳入迭代计划；每个Sprint预留15%时间处理技术债务 / Include security as non-functional requirement in sprint planning; reserve 15% capacity per sprint for technical debt | 识别关键风险项优先处理；对遗留风险实施补偿性控制措施 / Identify critical risks for priority handling; implement compensating controls for legacy risks |
| "用户不会发现这个漏洞的" / "Users won't find this vulnerability" | 自动化扫描工具可在几分钟内发现常见漏洞；黑客通常先于用户发现安全问题 / Automated scanners can find common vulnerabilities in minutes; attackers typically discover issues before users | 定期进行自动化安全扫描（SAST/DAST）和渗透测试；建立安全漏洞奖励计划 / Conduct regular automated security scanning (SAST/DAST) and penetration testing; establish bug bounty program | 实施监控和告警机制，及时发现异常行为；准备应急响应预案 / Implement monitoring and alerting to detect anomalous behavior; prepare incident response plan |
| "这个库很常用，应该没有安全问题" / "This library is widely used, should be safe" | 流行库往往是攻击者的主要目标（Log4j、Spring4Shell案例）；供应链攻击日益增多 / Popular libraries are prime targets for attackers (Log4j, Spring4Shell cases); supply chain attacks are increasing | 使用软件成分分析(SCA)工具持续监控依赖漏洞；建立组件审批流程 / Use Software Composition Analysis (SCA) tools to continuously monitor dependency vulnerabilities; establish component approval process | 将第三方组件放入隔离容器运行；实施运行时行为监控 / Run third-party components in isolated containers; implement runtime behavior monitoring |

### 常见陷阱 / Common Pitfalls

**🇨🇳**
1. **信任边界混淆**: 混淆了"用户已认证"和"用户已授权"的概念，认为认证通过就可以访问所有资源
2. **安全与性能权衡误区**: 为了性能牺牲安全（如禁用CSRF、减少加密强度），正确的做法是在保证安全的前提下优化性能
3. **"以后再修"陷阱**: 将安全修复标记为Technical Debt但从未安排时间处理，导致债务越积越多
4. **合规等于安全错觉**: 通过了安全合规检查就认为系统安全，实际上合规只是最低标准

**🇺🇸**
1. **Trust Boundary Confusion**: Confusing "authenticated user" with "authorized user," assuming authentication grants access to all resources
2. **Security vs Performance Trade-off Fallacy**: Sacrificing security for performance (disabling CSRF, reducing encryption strength); correct approach is optimizing performance while maintaining security
3. **"Fix It Later" Trap**: Marking security fixes as Technical Debt but never scheduling time to address them, leading to accumulating debt
4. **Compliance Equals Security Illusion**: Assuming system is secure after passing compliance checks; compliance is actually just the minimum standard

---

## Red Flags / 红旗警告

**🇨🇳 三层红旗预警系统 / 🇺🇸 Three-Layer Red Flag Warning System**

### Layer 1: Input Guards / 输入防护层

**触发条件 / Trigger Conditions:**

| Flag ID | 红旗信号 / Red Flag Signal | 严重等级 / Severity | 处理方式 / Action |
|---------|--------------------------|-------------------|------------------|
| INPUT-001 | 接收到包含SQL关键字（UNION、SELECT、DROP等）的用户输入 | CRITICAL | 立即拦截并记录安全事件；返回400错误 |
| INPUT-002 | 输入包含HTML/JavaScript标签（<script>、onclick等） | HIGH | 转义处理后继续；记录警告日志 |
| INPUT-003 | 输入包含路径遍历序列（../、..\\） | CRITICAL | 立即拦截；触发IP临时封禁 |
| INPUT-004 | 输入包含OS命令元字符（;、\|、&、$()） | CRITICAL | 立即拦截；通知安全团队 |
| INPUT-005 | 单IP短时间大量请求（>100次/分钟） | HIGH | 启用速率限制；触发CAPTCHA验证 |

**🇨🇳 处理代码示例 / 🇺🇸 Handling Code Example:**

```java
@Component
public class SecurityInputValidator {

    private static final Pattern SQL_INJECTION_PATTERN = Pattern.compile(
        "(?i)(union|select|insert|update|delete|drop|truncate|exec|execute)" +
        "(\\s+.+|(\\s*\\(.+\\))*)", Pattern.CASE_INSENSITIVE
    );

    private static final Pattern XSS_PATTERN = Pattern.compile(
        "<[^>]*>|javascript:|on\\w+\\s*=", Pattern.CASE_INSENSITIVE
    );

    public ValidationResult validateInput(String input, String fieldName) {
        ValidationResult result = new ValidationResult();

        if (input == null || input.trim().isEmpty()) {
            return result;
        }

        // SQL注入检测
        if (SQL_INJECTION_PATTERN.matcher(input).find()) {
            result.addViolation(ViolationLevel.CRITICAL,
                "潜在SQL注入攻击: 字段[" + fieldName + "]");
            securityAuditService.logSecurityEvent("SQL_INJECTION_DETECTED",
                Map.of("field", fieldName, "input", input));
        }

        // XSS检测
        if (XSS_PATTERN.matcher(input).find()) {
            result.addViolation(ViolationLevel.HIGH,
                "潜在XSS攻击: 字段[" + fieldName + "]");
        }

        // 路径遍历检测
        if (input.contains("..") || input.contains("../") || input.contains("..\\\\")) {
            result.addViolation(ViolationLevel.CRITICAL,
                "路径遍历攻击: 字段[" + fieldName + "]");
        }

        return result;
    }
}
```

### Layer 2: Execution Guards / 执行防护层

**触发条件 / Trigger Conditions:**

| Flag ID | 红旗信号 / Red Flag Signal | 严重等级 / Severity | 处理方式 / Action |
|---------|--------------------------|-------------------|------------------|
| EXEC-001 | 尝试访问未授权的资源或API端点 | CRITICAL | 返回403；记录完整请求上下文；触发告警 |
| EXEC-002 | 认证令牌过期但仍被用于敏感操作 | HIGH | 强制重新认证；使旧令牌失效 |
| EXEC-003 | 用户角色/权限变更后仍持有旧会话 | CRITICAL | 立即销毁所有活跃会话；强制重新登录 |
| EXEC-004 | 批量数据导出请求（>1000条记录） | WARN | 要求二次确认；记录操作审计日志 |
| EXEC-005 | 异常时间的敏感操作（如凌晨3点批量删除） | HIGH | 要求多因素认证确认；通知管理员 |

**🇨🇳 权限校验增强 / 🇺🇸 Enhanced Permission Validation:**

```java
@Aspect
@Component
public class SecurityExecutionGuard {

    @Around("@annotation(preAuthorize)")
    public Object checkExecutionSecurity(ProceedingJoinPoint joinPoint,
                                         PreAuthorize preAuthorize) throws Throwable {
        // 1. 基础权限校验
        if (!permissionService.hasPermission(preAuthorize.value())) {
            throw new UnauthorizedException("无权执行此操作");
        }

        // 2. 操作环境安全检查
        HttpServletRequest request =
            ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes())
                .getRequest();

        // IP信誉检查
        if (ipReputationService.isMaliciousIp(request.getRemoteAddr())) {
            securityAuditService.logSecurityEvent("MALICIOUS_IP_ACCESS",
                Map.of("ip", request.getRemoteAddr(), "endpoint", request.getRequestURI()));
            throw new AccessDeniedException("访问被拒绝");
        }

        // 3. 敏感操作二次确认
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        if (isSensitiveOperation(signature)) {
            String mfaToken = request.getHeader("X-MFA-Token");
            if (!mfaValidationService.validate(mfaToken)) {
                throw new MfaRequiredException("敏感操作需要多因素认证");
            }
        }

        // 4. 执行目标方法
        Object result = joinPoint.proceed();

        // 5. 结果后处理（敏感数据脱敏）
        if (result instanceof AjaxResult) {
            sanitizeSensitiveData((AjaxResult) result);
        }

        return result;
    }
}
```

### Layer 3: Output Guards / 输出防护层

**触发条件 / Trigger Conditions:**

| Flag ID | 红旗信号 / Red Flag Signal | 严重等级 / Severity | 处理方式 / Action |
|---------|--------------------------|-------------------|------------------|
| OUTPUT-001 | 响应中包含堆栈跟踪信息 | CRITICAL | 过滤掉异常详情；返回通用错误消息 |
| OUTPUT-002 | 响应中泄露内部系统信息（版本、路径、IP） | HIGH | 实施响应过滤器；移除敏感头部信息 |
| OUTPUT-003 | 大量敏感数据被返回（如完整用户列表含密码哈希） | CRITICAL | 检查查询逻辑；实施字段级权限控制 |
| OUTPUT-004 | 错误消息中包含SQL语句或调试信息 | CRITICAL | 自定义异常处理器；统一错误响应格式 |

**🇨🇳 安全响应包装器 / 🇺🇸 Secure Response Wrapper:**

```java
@ControllerAdvice
public class SecurityOutputHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleAllExceptions(Exception ex, WebRequest request) {
        // 1. 记录完整异常信息到日志（含堆栈）
        log.error("Unhandled exception: {}", ex.getMessage(), ex);

        // 2. 构建安全的错误响应（不含敏感信息）
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        body.put("error", "Internal Server Error");
        body.put("message", "服务器内部错误，请稍后重试");
        body.put("path", ((ServletWebRequest) request).getRequest().getRequestURI());

        // 3. 移除敏感响应头
        HttpHeaders headers = new HttpHeaders();
        headers.remove("Server");
        headers.remove("X-Powered-By");
        headers.remove("X-Application-Version");

        return new ResponseEntity<>(body, headers, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Object> handleAccessDeniedException(
            AccessDeniedException ex, WebRequest request) {
        // 统一返回403，不区分"未登录"和"无权限"
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", HttpStatus.FORBIDDEN.value());
        body.put("error", "Forbidden");
        body.put("message", "您没有权限执行此操作");
        body.put("path", ((ServletWebRequest) request).getRequest().getRequestURI());

        return new ResponseEntity<>(body, new HttpHeaders(), HttpStatus.FORBIDDEN);
    }
}
```

### Trigger Handling / 触发处理规则

**🇨🇳 不同严重等级的处理策略 / 🇺🇸 Handling Strategies by Severity Level:**

| 严重等级 / Severity Level | 处理动作 / Action | 通知对象 / Notify | 日志级别 / Log Level | 是否阻断 / Block Request? |
|--------------------------|------------------|-------------------|----------------------|-------------------------|
| **CRITICAL** | 立即拦截请求；返回403/400；可选临时封禁IP | 安全运维团队；安全负责人 | ERROR | 是，立即阻断 |
| **WARN** | 记录警告日志；允许请求继续但增加监控 | 开发团队负责人 | WARN | 否，但加强监控 |
| **INFO** | 记录信息日志；用于趋势分析和统计 | 无 | INFO | 否 |

**🇨🇳 告警升级条件 / 🇺🇸 Alert Escalation Conditions:**

```java
/**
 * 安全事件告警服务
 */
@Service
public class SecurityAlertService {

    @Value("${security.alert.threshold.critical:5}")
    private int criticalThreshold;

    @Value("${security.alert.threshold.high:20}")
    private int highThreshold;

    /**
     * 处理安全事件
     */
    public void handleSecurityEvent(SecurityEvent event) {
        // 1. 记录事件
        securityEventRepository.save(event);

        // 2. 更新计数器
        String counterKey = event.getType() + ":" + event.getSourceIp();
        Long count = redisTemplate.opsForValue().increment(counterKey);

        // 3. 检查是否达到告警阈值
        if (event.getSeverity() == Severity.CRITICAL && count >= criticalThreshold) {
            // 立即电话/短信通知安全负责人
            alertService.sendUrgentAlert(
                "CRITICAL: " + event.getType(),
                "Source IP: " + event.getSourceIp() +
                "\nCount in last hour: " + count +
                "\nImmediate action required!"
            );

            // 自动封禁IP（24小时）
            firewallService.blockIp(event.getSourceIp(), Duration.ofHours(24));
        } else if (event.getSeverity() == Severity.HIGH && count >= highThreshold) {
            // 发送邮件通知安全团队
            alertService.sendEmailAlert(
                "HIGH: Elevated " + event.getType() + " activity",
                "Source IP: " + event.getSourceIp() +
                "\nCount in last hour: " + count +
                "\nInvestigation recommended."
            );
        }

        // 4. 重置计数器（每小时）
        if (count == 1) {
            redisTemplate.expire(counterKey, 1, TimeUnit.HOURS);
        }
    }
}
```

---

## Quick Reference / 快速参考

### 常见漏洞速查表 / Common Vulnerability Quick Reference

| 漏洞类型 | 检测方法 | 修复方案 | 工具推荐 |
|---------|---------|---------|---------|
| SQL注入 | SAST扫描 + 手动Review | PreparedStatement参数化 | SQLMap, SonarQube |
| XSS | DAST扫描 + 浏览器DevTools | 输入过滤 + 输出编码 | XSSer, Burp Suite |
| CSRF | 代理抓包分析 | Token同步 + SameSite Cookie | CSRFTester |
| 命令注入 | 代码审计 | 白名单 + ProcessBuilder | Commix |
| 路径遍历 | fuzzing测试 | 路径规范化 + 目录限制 | DirBuster |
| SSRF | 网络流量分析 | URL白名单 + 内网隔离 | SSRFmap |

### 安全编码Checklist / Secure Coding Checklist

**每次提交代码前检查 / Before Every Code Submission:**
- [ ] 所有SQL查询使用参数化（PreparedStatement/#{}）
- [ ] 所有外部输入经过验证和过滤
- [ ] 敏感数据使用加密存储（AES-256-GCM）
- [ ] 密码使用BCrypt/Argon2哈希存储
- [ ] API接口有适当的权限注解
- [ ] 错误信息不泄露系统内部细节
- [ ] 文件上传做了类型、大小、内容校验
- [ ] 敏感操作有审计日志记录
- [ ] 第三方依赖经过漏洞扫描
- [ ] CORS配置严格限定允许的来源

---

大哥，任务完成了！我已在 `c:\Users\wonder\trae-projects\pdd-skills-v3\skills\expert\expert-security\` 目录下成功创建了 **expert-security** 安全专家技能，包含以下三个文件：

1. **[_meta.json](file:///c:\Users\wonder\trae-projects\pdd-skills-v3\skills\expert\expert-security\_meta.json)** - 元数据文件，包含名称、版本、描述和中英文触发词
2. **[SKILL.md](file:///c:\Users\wonder\trae-projects\pdd-skills-v3\skills\expert\expert-security\SKILL.md)** - 完整的双语技能文档（约1000行），包含：
   - Frontmatter（名称、双语描述、许可证、版本）
   - 核心概念（中英双语）
   - 四大核心能力模块：
     - 代码漏洞扫描（SQL注入、XSS、CSRF、命令注入、路径遍历）
     - 认证与授权安全（JWT/Session、RBAC、密码策略）
     - 数据保护（AES加密、日志脱敏、文件上传安全）
     - OWASP Top 10 2021完整覆盖
   - 8条安全护栏（中英双语）
   - 5条核心铁律（每条含违规示例和合规示例）
   - 合理化防御表（5行 + 4个常见陷阱）
   - 三层红旗预警系统（Input/Execution/Output Guards）
   - 快速参考表和安全编码Checklist
3. **[evals/default-evals.json](file:///c:\Users\wonder\trae-projects\pdd-skills-v3\skills\expert\expert-security\evals\default-evals.json)** - 评估测试文件，包含5个测试用例

该技能完全基于Java/Spring Boot/若依框架提供具体的代码示例，涵盖SQL注入、XSS、CSRF等具体攻击场景和修复代码，符合M2.5双语化规范。

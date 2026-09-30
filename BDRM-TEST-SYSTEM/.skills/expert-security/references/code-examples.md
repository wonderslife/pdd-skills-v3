# expert-security 代码示例库（Code Examples）

> 本文件为 expert-security 的参考资料，按需加载。核心流程与规则见 SKILL.md。

## 1. 代码漏洞扫描

### 1.1 SQL注入检测与修复

**攻击场景分析**

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

| 攻击向量 | 示例载荷 | 影响 | 严重度 |
|---------|---------|------|--------|
| 认证绕过 | `' OR '1'='1` | 完全数据库访问 | CRITICAL |
| 数据提取 | `' UNION SELECT * FROM sys_user--` | 敏感数据泄露 | CRITICAL |
| 数据操纵 | `'; DROP TABLE sys_user;--` | 数据破坏 | CRITICAL |
| 盲注 | `' AND 1=CAST((SELECT password FROM sys_user LIMIT 1) AS INT)--` | 信息泄露 | HIGH |

**MyBatis安全配置示例:**

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

### 1.2 XSS跨站脚本防护

**攻击类型分类**

| 类型 | 示例 | 防护策略 |
|------|------|---------|
| Reflected XSS | `<script>alert('XSS')</script>` | 输出转义 + CSP |
| Stored XSS | `<img src=x onerror=alert(1)>` | 输入过滤 + 输出编码 |
| DOM-based XSS | `javascript:alert(document.cookie)` | DOM操作安全 + 输入验证 |

**Spring Boot防护配置:**

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

### 1.3 CSRF跨站请求伪造防护

**Spring Boot CSRF防御方案:**

```java
// 1. 启用CSRF保护
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
            )
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
$(document).ajaxSend(function(e, xhr, options) {
    var token = $("meta[name='_csrf']").attr("content");
    var header = $("meta[name='_csrf_header']").attr("content");
    xhr.setRequestHeader(header, token);
});
</script>
```

### 1.4 命令注入防护

```java
// ❌ VULNERABLE: 直接拼接命令
Runtime.getRuntime().exec("ping " + ipAddress);

// ✅ SECURE: 白名单验证 + 参数化执行
public boolean pingHost(String ipAddress) {
    if (!isValidIpAddress(ipAddress)) {
        throw new IllegalArgumentException("Invalid IP address format");
    }
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

### 1.5 路径遍历防护

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
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new SecurityException("Invalid filename");
        }
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

## 2. 认证与授权安全

### 2.1 身份认证安全（JWT/Session）

**JWT安全最佳实践:**

```java
// JWT工具类 - 安全实现
@Component
public class JwtTokenUtil {
    @Value("${jwt.secret}")
    private String secret;
    @Value("${jwt.expiration:86400000}")
    private long expiration;

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

**Session安全管理:**

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

### 2.2 权限控制（RBAC/ABAC）

**若依框架RBAC注解示例:**

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

### 2.3 密码策略

**密码强度要求:**

```java
// 密码验证器
public class PasswordValidator {
    private static final int MIN_LENGTH = 8;
    private static final int MAX_LENGTH = 20;

    public static ValidationResult validatePassword(String password) {
        ValidationResult result = new ValidationResult();
        if (password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) {
            result.addError("密码长度必须在" + MIN_LENGTH + "-" + MAX_LENGTH + "个字符之间");
        }
        if (!password.matches(".*[A-Z].*")) {
            result.addError("密码必须包含至少一个大写字母");
        }
        if (!password.matches(".*[a-z].*")) {
            result.addError("密码必须包含至少一个小写字母");
        }
        if (!password.matches(".*\\d.*")) {
            result.addError("密码必须包含至少一个数字");
        }
        if (!password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?].*")) {
            result.addError("密码必须包含至少一个特殊字符");
        }
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

## 3. 数据保护

### 3.1 敏感数据加密

**AES加密工具类:**

```java
@Component
public class AesEncryptor {
    @Value("${encrypt.aes.key}")
    private String aesKey;
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;

    public String encrypt(String plaintext) throws Exception {
        byte[] iv = new byte[GCM_IV_LENGTH];
        new SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        SecretKeySpec keySpec = new SecretKeySpec(
            Base64.getDecoder().decode(aesKey), "AES");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);
        byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        byte[] encryptedWithIv = new byte[GCM_IV_LENGTH + encrypted.length];
        System.arraycopy(iv, 0, encryptedWithIv, 0, GCM_IV_LENGTH);
        System.arraycopy(encrypted, 0, encryptedWithIv, GCM_IV_LENGTH, encrypted.length);
        return Base64.getEncoder().encodeToString(encryptedWithIv);
    }

    public String decrypt(String encryptedText) throws Exception {
        byte[] decoded = Base64.getDecoder().decode(encryptedText);
        byte[] iv = Arrays.copyOfRange(decoded, 0, GCM_IV_LENGTH);
        byte[] encrypted = Arrays.copyOfRange(decoded, GCM_IV_LENGTH, decoded.length);
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

### 3.2 日志脱敏

**敏感信息脱敏处理器:**

```java
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface Sensitive {
    SensitiveType value() default SensitiveType.DEFAULT;
}

public enum SensitiveType {
    DEFAULT, PHONE, ID_CARD, BANK_CARD, EMAIL, PASSWORD, NAME
}

public class DesensitizeUtils {
    public static String desensitize(String value, SensitiveType type) {
        if (value == null || value.isEmpty()) return value;
        switch (type) {
            case PHONE: return value.replaceAll("(\\d{3})\\d{4}(\\d{4})", "$1****$2");
            case ID_CARD: return value.replaceAll("(\\d{4})\\d{10}(\\d{4})", "$1**********$2");
            case BANK_CARD: return value.replaceAll("(\\d{4})\\d+(\\d{4})", "$1***********$2");
            case EMAIL: return value.replaceAll("(^.)[^@]*(@.*$)", "$1***$2");
            case PASSWORD: return "******";
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

### 3.3 文件上传安全

**安全上传控制器:**

```java
@RestController
@RequestMapping("/common/upload")
public class CommonUploadController {
    private static final Set<String> ALLOWED_EXTENSIONS =
        Set.of("jpg", "jpeg", "png", "gif", "bmp", "doc", "docx",
               "xls", "xlsx", "pdf", "txt", "zip", "rar");
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    @PostMapping("/upload")
    public AjaxResult uploadFile(MultipartFile file) throws Exception {
        // 1. 文件非空检查
        if (file.isEmpty()) return error("上传文件不能为空");
        // 2. 文件大小检查
        if (file.getSize() > MAX_FILE_SIZE) return error("上传文件大小不能超过10MB");
        // 3. 文件扩展名检查
        String originalFilename = file.getOriginalFilename();
        String extension = FilenameUtils.getExtension(originalFilename).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) return error("不允许上传此类型的文件：" + extension);
        // 4. 文件内容类型验证（防止MIME类型伪造）
        String contentType = file.getContentType();
        if (!isValidContentType(contentType, extension)) return error("文件类型与内容不匹配");
        // 5. 文件内容魔数验证（防止文件头伪装）
        if (!validateFileHeader(file)) return error("文件内容验证失败");
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
        try (InputStream is = file.getInputStream()) { is.read(header); }
        // JPEG: FF D8 FF | PNG: 89 50 4E 47 | GIF: 47 49 46 38 | PDF: 25 50 44 46
        String hex = bytesToHex(header);
        return hex.startsWith("FFD8FF") || hex.startsWith("89504E47")
            || hex.startsWith("47494638") || hex.startsWith("25504446");
    }

    private String generateSafeFileName(String extension) {
        return UUID.randomUUID().toString().replace("-", "")
               + "_" + System.currentTimeMillis() + "." + extension;
    }
}
```

## 4. OWASP Top 10 各条目代码示例

### A01: Broken Access Control / 访问控制失效

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
    if (user == null) return error("用户不存在");
    // 4. 敏感字段脱敏
    user.setPhone(DesensitizeUtils.desensitize(user.getPhone(), SensitiveType.PHONE));
    return success(user);
}
```

### A07: Authentication Failures / 身份认证失效

**安全认证流程:**

```java
@Service
public class SecureLoginService {
    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private RedisCache redisCache;

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
            redisCache.setCacheObject(key, attempts, 30, TimeUnit.MINUTES);
            throw new ServiceException("登录失败次数过多，账户已锁定30分钟");
        }
    }
}
```

## 5. Iron Law 违规/合规示例

### Iron Law #1: 安全优先原则

**❌ 违规示例:**
```java
// 项目紧急上线，暂时关闭SQL注入防护
// TODO: 上线后再修复安全问题
@GetMapping("/search")
public List<User> search(@RequestParam String keyword) {
    String sql = "SELECT * FROM user WHERE name LIKE '%" + keyword + "%'";
    return jdbcTemplate.queryForList(sql);  // CRITICAL: SQL注入漏洞
}
```

**✅ 合规示例:**
```java
// 即使项目紧张，也必须使用参数化查询
@GetMapping("/search")
@PreAuthorize("@ss.hasPermi('system:user:list')")
public List<User> search(@RequestParam String keyword) {
    if (keyword.length() > 50) throw new ServiceException("搜索关键词过长");
    String sql = "SELECT * FROM sys_user WHERE user_name LIKE ?";
    return jdbcTemplate.queryForList(sql, "%" + keyword + "%");
}
```

### Iron Law #2: 最小权限原则

**❌ 违规示例:**
```java
@PreAuthorize("@ss.hasRole('admin')")  // 过于宽泛
public List<User> getAllUsers() {
    return userService.selectAll();  // 可查看所有用户，包括超管
}
```

**✅ 合规示例:**
```java
@PreAuthorize("@ss.hasPermi('system:user:list')")
public TableDataInfo list(SysUser user) {
    startPage();
    // 只能查询本部门及下级部门的数据
    List<SysUser> list = userService.selectUserList(user);
    return getDataTable(list);
}
```

### Iron Law #3: 输入验证强制

**❌ 违规示例:**
```java
@PostMapping("/delete")
public AjaxResult delete(@RequestParam Long userId) {
    return toAjax(userService.deleteUserById(userId));  // 可能删除任意用户
}
```

**✅ 合规示例:**
```java
@PostMapping("/delete")
@PreAuthorize("@ss.hasPermi('system:user:remove')")
@Log(title = "用户管理", businessType = BusinessType.DELETE)
public AjaxResult delete(@PathVariable Long[] userIds) {
    for (Long userId : userIds) {
        userService.checkUserDataScope(userId);
        if (userId.equals(SecurityUtils.getUserId())) return error("当前用户不能删除");
        if (isAdmin(userId)) return error("不允许删除管理员账号");
    }
    return toAjax(userService.deleteUserByIds(userIds));
}
```

### Iron Law #4: 加密默认开启

**❌ 违规示例:**
```java
@Entity
public class User {
    @Column(name = "id_card")
    private String idCard;  // 明文存储身份证
    @Column(name = "phone")
    private String phone;   // 明文存储手机号
}
```

**✅ 合规示例:**
```java
@Entity
public class User {
    @Column(name = "id_card")
    private String idCardEncrypted;  // AES-256-GCM加密存储
    @Column(name = "phone")
    private String phoneEncrypted;   // AES-256-GCM加密存储

    @SensitiveField(type = SensitiveType.ID_CARD)
    public String getIdCard() { return aesEncryptor.decrypt(idCardEncrypted); }
    public void setIdCard(String idCard) { this.idCardEncrypted = aesEncryptor.encrypt(idCard); }
}
```

### Iron Law #5: 不信任客户端

**❌ 违规示例:**
```javascript
// 前端校验价格（可被绕过）
function validatePrice(price) {
    if (price < 0) { alert('价格不能为负数'); return false; }
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

**✅ 合规示例:**
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
    if (product == null) return error("商品不存在");
    // 3. 使用服务器端价格计算总价
    BigDecimal totalPrice = product.getPrice()
                              .multiply(BigDecimal.valueOf(orderDTO.getQuantity()));
    // 4. 价格合理性校验（防价格篡改）
    if (orderDTO.getPrice().compareTo(product.getPrice()) != 0) {
        securityAuditService.logSuspiciousActivity(
            SecurityUtils.getUserId(), "PRICE_TAMPERING", "订单价格与实际不符");
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

## 6. Red Flags 三层防护代码示例

### Layer 1: 输入防护 - 处理代码

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
        if (input == null || input.trim().isEmpty()) return result;
        if (SQL_INJECTION_PATTERN.matcher(input).find()) {
            result.addViolation(ViolationLevel.CRITICAL,
                "潜在SQL注入攻击: 字段[" + fieldName + "]");
            securityAuditService.logSecurityEvent("SQL_INJECTION_DETECTED",
                Map.of("field", fieldName, "input", input));
        }
        if (XSS_PATTERN.matcher(input).find()) {
            result.addViolation(ViolationLevel.HIGH, "潜在XSS攻击: 字段[" + fieldName + "]");
        }
        if (input.contains("..") || input.contains("../") || input.contains("..\\\\")) {
            result.addViolation(ViolationLevel.CRITICAL, "路径遍历攻击: 字段[" + fieldName + "]");
        }
        return result;
    }
}
```

### Layer 2: 执行防护 - 权限校验增强

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

### Layer 3: 输出防护 - 安全响应包装器

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

### 告警升级条件

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

    public void handleSecurityEvent(SecurityEvent event) {
        // 1. 记录事件
        securityEventRepository.save(event);
        // 2. 更新计数器
        String counterKey = event.getType() + ":" + event.getSourceIp();
        Long count = redisTemplate.opsForValue().increment(counterKey);
        // 3. 检查是否达到告警阈值
        if (event.getSeverity() == Severity.CRITICAL && count >= criticalThreshold) {
            alertService.sendUrgentAlert(
                "CRITICAL: " + event.getType(),
                "Source IP: " + event.getSourceIp() + "\nCount in last hour: " + count
                + "\nImmediate action required!"
            );
            firewallService.blockIp(event.getSourceIp(), Duration.ofHours(24));
        } else if (event.getSeverity() == Severity.HIGH && count >= highThreshold) {
            alertService.sendEmailAlert(
                "HIGH: Elevated " + event.getType() + " activity",
                "Source IP: " + event.getSourceIp() + "\nCount in last hour: " + count
                + "\nInvestigation recommended."
            );
        }
        // 4. 重置计数器（每小时）
        if (count == 1) {
            redisTemplate.expire(counterKey, 1, TimeUnit.HOURS);
        }
    }
}
```
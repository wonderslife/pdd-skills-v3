package org.dromara.inspect.service.impl;

import cn.hutool.core.util.StrUtil;
import cn.hutool.crypto.SecureUtil;
import cn.hutool.crypto.symmetric.SymmetricCrypto;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import lombok.extern.slf4j.Slf4j;
import org.dromara.inspect.service.IQrCodeService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * 二维码服务实现
 * <p>
 * 说明：
 * 1. 加密使用 AES（密钥由配置项 inspect.qrcode.secret 经 MD5 派生为 32 字节，得到 AES-256）。
 *    Hutool 的 AES 默认 CBC 模式且把随机 IV 拼在密文前，因此密文每次不同，
 *    手工改动密文会导致解密失败 —— 满足 PRD「防伪造」要求。
 * 2. 二维码 PNG 由 zxing core 直接绘制，不依赖 zxing-javase。
 *    需在 pom 中引入 com.google.zxing:core（本项目使用的本地仓库已有 3.3.3）。
 *
 * @author ruoyi
 */
@Slf4j
@Service
public class QrCodeServiceImpl implements IQrCodeService {

    /** 默认密钥，生产环境务必通过配置覆盖 */
    private static final String DEFAULT_SECRET = "inspect-qrcode-secret-2026";

    /** 二维码内容前缀（与 PRD 6.1 约定一致） */
    @Value("${inspect.qrcode.content-prefix:https://localhost/h5/scan?p=}")
    private String contentPrefix;

    @Value("${inspect.qrcode.secret:" + DEFAULT_SECRET + "}")
    private String secret;

    /** 二维码默认尺寸 */
    @Value("${inspect.qrcode.size:300}")
    private int defaultSize;

    private volatile SymmetricCrypto cachedCrypto;

    /**
     * 延迟初始化加解密器（避免每次请求都派生密钥）
     */
    private SymmetricCrypto crypto() {
        SymmetricCrypto local = cachedCrypto;
        if (local == null) {
            synchronized (this) {
                local = cachedCrypto;
                if (local == null) {
                    String key = SecureUtil.md5(StrUtil.blankToDefault(secret, DEFAULT_SECRET));
                    local = SecureUtil.aes(key.getBytes(StandardCharsets.UTF_8));
                    cachedCrypto = local;
                }
            }
        }
        return local;
    }

    @Override
    public String buildContent(Long pointId) {
        if (pointId == null) {
            throw new IllegalArgumentException("点位ID不能为空");
        }
        String encrypted = crypto().encryptBase64(String.valueOf(pointId));
        // Base64 中的 '+' '/' '=' 在 URL query 中会被转义，这里统一替换为 URL 安全字符
        String safe = encrypted.replace('+', '-').replace('/', '_').replace("=", "");
        String prefix = StrUtil.blankToDefault(contentPrefix, "https://localhost/h5/scan?p=");
        return prefix + safe;
    }

    @Override
    public Long resolvePointId(String content) {
        if (StrUtil.isBlank(content)) {
            return null;
        }
        String token = content.trim();
        // 兼容三种入参：完整 URL、仅 p 参数值、裸密文
        int pIdx = token.indexOf("p=");
        if (pIdx >= 0) {
            token = token.substring(pIdx + 2);
            int amp = token.indexOf('&');
            if (amp >= 0) {
                token = token.substring(0, amp);
            }
        }
        // 还原 URL 安全字符
        token = token.replace('-', '+').replace('_', '/');
        // 补齐 Base64 padding
        int mod = token.length() % 4;
        if (mod == 2) {
            token += "==";
        } else if (mod == 3) {
            token += "=";
        }
        try {
            String plain = crypto().decryptStr(token);
            if (StrUtil.isBlank(plain) || !plain.chars().allMatch(Character::isDigit)) {
                return null;
            }
            return Long.parseLong(plain);
        } catch (Exception e) {
            log.warn("二维码解析失败，疑似被篡改或密钥不匹配: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public byte[] generatePng(String content, int width, int height) {
        int w = width > 0 ? width : defaultSize;
        int h = height > 0 ? height : defaultSize;
        try {
            Map<EncodeHintType, Object> hints = new HashMap<>(4);
            hints.put(EncodeHintType.CHARACTER_SET, StandardCharsets.UTF_8.name());
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 1);

            BitMatrix matrix = new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, w, h, hints);
            BufferedImage image = new BufferedImage(matrix.getWidth(), matrix.getHeight(), BufferedImage.TYPE_INT_RGB);
            for (int x = 0; x < matrix.getWidth(); x++) {
                for (int y = 0; y < matrix.getHeight(); y++) {
                    image.setRGB(x, y, matrix.get(x, y) ? 0xFF000000 : 0xFFFFFFFF);
                }
            }
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", bos);
            return bos.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("二维码生成失败: " + e.getMessage(), e);
        }
    }

}

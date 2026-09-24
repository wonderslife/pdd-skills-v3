package org.dromara.yuqing.alert;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

/**
 * 预警事件聚合指纹（F-010 验收标准 7）
 *
 * <p>同一事件持续发酵时，多条舆情应聚合到同一预警，避免重复预警刷屏：
 * 有事件聚合 ID 时按 {@code cluster:<id>}，否则退化为
 * {@code task:<id>:<标题指纹>}。</p>
 *
 * @author ruoyi
 */
public final class AlertFingerprint {

    private AlertFingerprint() {
    }

    /** 生成聚合指纹；长度恒定，可直接入库并建索引 */
    public static String of(AlertCandidate c) {
        if (c == null) {
            return "unknown";
        }
        if (c.getClusterId() != null) {
            return "cluster:" + c.getClusterId();
        }
        long taskId = c.getTaskId() == null ? 0L : c.getTaskId();
        return "task:" + taskId + ":" + sha16(normalize(c.getTitle()));
    }

    /** 标题归一化：去空白、去标点、转小写 */
    public static String normalize(String title) {
        if (title == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(title.length());
        for (int i = 0; i < title.length(); i++) {
            char ch = title.charAt(i);
            if (Character.isWhitespace(ch) || Character.isSpaceChar(ch)) {
                continue;
            }
            if (Character.isLetterOrDigit(ch)) {
                sb.append(Character.toLowerCase(ch));
            }
        }
        return sb.toString();
    }

    /** SHA-256 前 16 位十六进制 */
    public static String sha16(String raw) {
        String base = raw == null ? "" : raw;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(base.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(32);
            for (int i = 0; i < 8; i++) {
                sb.append(String.format(Locale.ROOT, "%02x", digest[i]));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 是 JDK 强制实现的算法，走到这里说明运行环境异常；退化为长度受限的可读串
            String safe = base.length() > 32 ? base.substring(0, 32) : base;
            return "plain:" + safe;
        }
    }
}

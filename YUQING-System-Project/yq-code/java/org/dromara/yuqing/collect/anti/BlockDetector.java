package org.dromara.yuqing.collect.anti;

import org.dromara.yuqing.collect.http.FetchResponse;
import org.dromara.yuqing.collect.model.BlockSignal;
import org.dromara.yuqing.collect.model.BlockType;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 被拦信号识别（《技术架构说明》§5.5.1）。
 *
 * <p>先识别是否被拦，再决定是否升级对抗手段 —— 而不是一上来就上无头浏览器。</p>
 *
 * @author ruoyi
 */
@Component
public class BlockDetector {

    /** 人机校验特征 */
    private static final List<String> CAPTCHA_MARKS = List.of(
        "验证码", "滑动验证", "安全验证", "人机验证", "拖动滑块", "点击完成验证",
        "captcha", "geetest", "nc_1_n1z", "cf-challenge", "verify you are human"
    );

    /** 登录墙 / 付费墙特征（合规红线，不破解，仅识别并留痕） */
    private static final List<String> PAYWALL_MARKS = List.of(
        "登录后查看全文", "开通会员", "付费阅读", "订阅后可见", "请先登录", "登录后继续"
    );

    /** 前端渲染壳特征 */
    private static final List<String> SHELL_MARKS = List.of(
        "<div id=\"app\"></div>", "<div id=\"root\"></div>", "window.__INITIAL_STATE__",
        "__NEXT_DATA__", "noscript"
    );

    /**
     * 判定响应是否被拦截。
     *
     * @param response         响应
     * @param keyword          检索词，用于蜜罐 / 降级内容判定；为 null 时跳过该检查
     * @param minContentLength 有效内容长度下限
     * @return 判定结果
     */
    public BlockSignal detect(FetchResponse response, String keyword, int minContentLength) {
        if (response == null) {
            return BlockSignal.blocked(BlockType.HTTP_ERROR, "响应为空");
        }
        int code = response.getStatusCode();
        if (code == 429) {
            return BlockSignal.blocked(BlockType.RATE_LIMITED, "HTTP 429 触发限流");
        }
        if (code == 403 || code == 401 || code == 407) {
            return BlockSignal.blocked(BlockType.HTTP_ERROR, "HTTP " + code + " 拒绝访问");
        }
        if (code == 503) {
            return BlockSignal.blocked(BlockType.HTTP_ERROR, "HTTP 503 服务不可用");
        }
        if (code >= 400) {
            return BlockSignal.blocked(BlockType.HTTP_ERROR, "HTTP " + code);
        }
        String body = response.getBody();
        if (body == null || body.isBlank()) {
            return BlockSignal.blocked(BlockType.RENDER_REQUIRED, "HTTP 200 但正文为空");
        }
        String lower = body.toLowerCase();
        for (String mark : CAPTCHA_MARKS) {
            if (lower.contains(mark.toLowerCase())) {
                return BlockSignal.blocked(BlockType.CAPTCHA, "命中人机校验特征: " + mark);
            }
        }
        for (String mark : PAYWALL_MARKS) {
            if (body.contains(mark)) {
                return BlockSignal.blocked(BlockType.PAYWALL, "命中登录/付费墙特征: " + mark);
            }
        }
        if (looksLikeShell(body, minContentLength)) {
            return BlockSignal.blocked(BlockType.RENDER_REQUIRED, "疑似前端渲染壳，需切渲染通道");
        }
        if (keyword != null && !keyword.isBlank() && !body.contains(keyword)) {
            return BlockSignal.blocked(BlockType.IRRELEVANT, "返回内容未命中检索词，疑似蜜罐或降级内容");
        }
        return BlockSignal.ok();
    }

    /**
     * 是否为空壳页（HTML 标签极少但含脚本）。
     *
     * @param body 正文
     * @param minLength 最低内容长度
     * @return true 表示需要渲染通道
     */
    public boolean looksLikeShell(String body, int minLength) {
        if (body == null || body.length() > Math.max(minLength, 400)) {
            return false;
        }
        String lower = body.toLowerCase();
        if (!lower.contains("<script")) {
            return false;
        }
        for (String mark : SHELL_MARKS) {
            if (lower.contains(mark.toLowerCase())) {
                return true;
            }
        }
        int tagCount = lower.split("<").length - 1;
        return tagCount < 12;
    }

    /**
     * 内容长度异常检测（蜜罐 / 陷阱字段）。
     *
     * @param text      文本
     * @param minLength 有效内容下限
     * @return true 表示疑似无效内容
     */
    public boolean looksLikeTrap(String text, int minLength) {
        return text == null || text.trim().length() < minLength;
    }
}

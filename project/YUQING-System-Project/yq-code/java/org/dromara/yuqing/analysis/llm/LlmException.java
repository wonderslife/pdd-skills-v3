package org.dromara.yuqing.analysis.llm;

/**
 * 大模型通道异常（F-007）
 *
 * <p>只在「配置错误」这类不该被静默吞掉的场景抛出（例如启用了通道却没配 apiKey）。
 * 网络抖动、限流、返回体不合法等运行期问题一律走
 * {@link LlmResponse#fail(String)} 返回值，由上层决定重试策略。</p>
 *
 * @author ruoyi
 */
public class LlmException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public LlmException(String message) {
        super(message);
    }

    public LlmException(String message, Throwable cause) {
        super(message, cause);
    }
}

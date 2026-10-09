package org.dromara.yuqing.analysis.llm;

/**
 * 大模型对话通道（F-007）
 *
 * <p><b>为什么抽一层接口：</b>研判引擎的核心难点不是「怎么发 HTTP」，
 * 而是「拿到一段不可信文本后怎么变成结构化结论」。把传输层隔离掉，
 * 提示词 / 解析 / 融合这三块就能脱离网络单独测试，
 * 也让「内网模型」「批量推理服务」等其它形态可以后续接入而不动业务代码。</p>
 *
 * <p><b>实现约定：</b>任何网络或协议层异常都不得向上抛裸异常，
 * 一律包成 {@link LlmResponse} 的失败态携带可读原因 ——
 * 界面上要能直接看到「为什么这条研判失败了」。</p>
 *
 * @author ruoyi
 */
public interface ILlmClient {

    /** 通道标识，用于日志与失败原因描述 */
    String name();

    /** 通道是否可用（未配置即不可用，调用方据此决定是否走规则兜底） */
    boolean isEnabled();

    /** 当前模型名（落库到研判结论的 model_version） */
    String modelName();

    /**
     * 发起一次对话补全。
     *
     * @param request 提示词与采样参数，不得为 null
     * @return 成功态携带正文；失败态携带 reason，永不返回 null
     */
    LlmResponse chat(LlmRequest request);
}

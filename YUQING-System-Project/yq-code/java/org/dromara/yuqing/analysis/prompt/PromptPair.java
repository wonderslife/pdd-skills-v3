package org.dromara.yuqing.analysis.prompt;

/**
 * 系统提示 + 用户提示双段结构（F-007）
 *
 * <p>系统段承载「判定规范」，用户段承载「待分析原文」。
 * 拆成两段而不是拼成一段，是为了让原文始终处在明确的角色边界之内 ——
 * 模型对 system 段指令的服从度高于 user 段，把规范放在 system
 * 本身就降低了原文里夹带指令被当作要求执行的概率。</p>
 *
 * <p>刻意不用 Lombok：两个字段都是 final，手写构造器与访问器
 * 比依赖「Lombok 会不会替我生成」更不容易出错。</p>
 *
 * @author ruoyi
 */
public final class PromptPair {

    private final String system;
    private final String user;

    public PromptPair(String system, String user) {
        this.system = system == null ? "" : system;
        this.user = user == null ? "" : user;
    }

    public String getSystem() {
        return system;
    }

    public String getUser() {
        return user;
    }
}

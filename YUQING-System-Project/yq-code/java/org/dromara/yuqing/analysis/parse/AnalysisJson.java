package org.dromara.yuqing.analysis.parse;

import org.dromara.common.json.utils.JsonUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 研判引擎的 JSON 门面。
 *
 * <p><b>为什么不直接用 {@link JsonUtils}：</b>该工具的 {@code JSON_MAPPER} 是
 * 静态 final 字段（{@code SpringUtils.getBean(JsonMapper.class)}），
 * 容器未启动时类初始化即抛 {@code ExceptionInInitializerError}。
 * 研判引擎的纯函数（提示词构建 / 结果解析 / 相似度）必须在 Spring 之外
 * 也能跑 —— 离线自测、以及将来可能的大模型评测 CLI —— 因此这里做一层兜底。</p>
 *
 * <p><b>为什么不复用 {@code collect.json.CollectJson}：</b>两者成因相同、
 * 实现几乎一致，但那个门面位于采集包内。研判引擎依赖采集包会把
 * 「采什么」与「怎么判」两个独立关注点绑在一起，因此各自持有一份
 * 三十行的门面，代价小于语义耦合。</p>
 *
 * <p>注意：本工程用的是 <b>Jackson 3</b>（{@code tools.jackson}），
 * 不是 Jackson 2 的 {@code com.fasterxml.jackson}。</p>
 *
 * @author ruoyi
 */
public final class AnalysisJson {

    /** 容器不可用时的兜底 mapper，双检锁懒加载。 */
    private static volatile JsonMapper fallback;

    private AnalysisJson() {
    }

    /**
     * 解析 JSON 字符串为树。
     *
     * @param text JSON 文本
     * @return 根节点
     */
    public static JsonNode readTree(String text) {
        return mapper().readTree(text);
    }

    /**
     * 序列化为 JSON 字符串。
     *
     * @param object 待序列化对象
     * @return JSON 文本
     */
    public static String toJsonString(Object object) {
        return mapper().writeValueAsString(object);
    }

    /**
     * 取 JSON 映射器：优先容器 Bean，取不到则用自建实例。
     *
     * @return JsonMapper
     */
    public static JsonMapper mapper() {
        try {
            JsonMapper bean = JsonUtils.getJsonMapper();
            if (bean != null) {
                return bean;
            }
        } catch (Throwable ignore) {
            /* 容器未启动 / 静态初始化失败：走兜底实例，不打扰调用方 */
        }
        JsonMapper local = fallback;
        if (local == null) {
            synchronized (AnalysisJson.class) {
                local = fallback;
                if (local == null) {
                    local = JsonMapper.builder().build();
                    fallback = local;
                }
            }
        }
        return local;
    }
}

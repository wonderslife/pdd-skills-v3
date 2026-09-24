package org.dromara.yuqing.collect.adapter;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 站点适配器配置规格：把「每站怎么写」变成配置（《技术架构说明》§5.3）。
 *
 * <p>站点改版导致采集失效时，改配置即可恢复，无需发版。</p>
 *
 * @author ruoyi
 */
@Data
public class AdapterSpec {

    /** 适配器标识，对应 yq_channel.adapter_class 与配置 key */
    private String code;

    /** 渠道展示名 */
    private String channelName;

    /** 入口类型：static（静态 HTML）/ render（动态渲染）/ api（开放接口）/ mock（离线自测） */
    private String entryType = "static";

    /** 列表页地址模板，支持 {kw} 与 {page} 占位符 */
    private String listUrl;

    /** 列表项选择器（static / render） */
    private String listItemSelector;

    /** 列表 JSON 数组路径（api），如 data.list 或 data[0].items */
    private String listJsonPath;

    /** 请求方法（api） */
    private String method = "GET";

    /** 请求体模板（api POST） */
    private String requestBody;

    /** 附加请求头 */
    private Map<String, String> headers = new LinkedHashMap<>();

    /** 字段抽取规则 */
    private Map<String, FieldRule> fields = new LinkedHashMap<>();

    /** 分页规则 */
    private PageRule pageRule = new PageRule();

    /** 详情页规则 */
    private DetailRule detailRule = new DetailRule();

    /** 反爬参数 */
    private AntiBotRule antiBot = new AntiBotRule();

    /** mock 适配器生成条数 */
    private int mockSize = 30;

    /** 合规备注：是否允许采集、robots 策略、是否需授权（PRD §8.4 待确认项 3） */
    private String compliance = "";

    /**
     * 生效最大翻页数。
     *
     * @return 至少为 1
     */
    public int maxPage() {
        return pageRule == null ? 1 : Math.max(1, pageRule.getMaxPage());
    }

    /**
     * 取字段规则。
     *
     * @param name 逻辑字段名，如 title / opinionUrl
     * @return 规则；未配置返回 null
     */
    public FieldRule field(String name) {
        return fields == null ? null : fields.get(name);
    }

    /**
     * 分页规则。
     */
    @Data
    public static class PageRule {
        /** 起始页 */
        private int start = 1;
        /** 每页条数（仅作参考，实际以解析结果为准） */
        private int size = 20;
        /** 最大翻页数 */
        private int maxPage = 5;
    }

    /**
     * 单字段抽取规则。
     */
    @Data
    public static class FieldRule {
        /** CSS 选择器（static / render）或点分路径（api） */
        private String selector;
        /** 取值方式：text / html / href / src / 任意属性名 */
        private String attr = "text";
        /** 前缀（相对链接补全） */
        private String prefix = "";
        /** 后缀 */
        private String suffix = "";
        /** 时间格式，如 yyyy-MM-dd HH:mm */
        private String pattern = "";
        /** api 专用：点分路径（优先于 selector） */
        private String jsonPath = "";
        /** 缺失时的兜底值 */
        private String defaultValue = "";
    }

    /**
     * 详情页规则。
     */
    @Data
    public static class DetailRule {
        /** 是否抓取详情页正文 */
        private boolean enabled = false;
        /** 正文容器选择器 */
        private String contentSelector = "";
        /** 详情页翻页数 */
        private int pageNum = 1;
    }

    /**
     * 反爬参数。
     */
    @Data
    public static class AntiBotRule {
        /** 是否走代理 */
        private boolean useProxy = true;
        /** 随机延时下限（毫秒） */
        private int minIntervalMs = 1500;
        /** 随机延时上限（毫秒） */
        private int maxIntervalMs = 4000;
        /** 固定 Referer */
        private String referer = "";
    }
}

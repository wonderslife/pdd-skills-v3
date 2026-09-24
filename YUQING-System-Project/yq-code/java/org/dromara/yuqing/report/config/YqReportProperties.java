package org.dromara.yuqing.report.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 舆情日报 / 月报生成配置（F-014 / F-015）
 *
 * <p>前缀 {@code yuqing.report}。所有开关默认保守：{@code enabled} 默认 true 但
 * {@code auto-generate} 默认 false —— 定时任务依赖 SnailJob 控制台创建执行器，
 * 在运维配置前不自动跑，避免半夜给全公司推送空日报。</p>
 *
 * @author ruoyi
 */
@Data
@Component
@ConfigurationProperties(prefix = "yuqing.report")
public class YqReportProperties {

    /** 是否启用报告生成引擎（产品开关） */
    private boolean enabled = true;

    /** 是否启用定时自动生成（需先在 SnailJob 控制台创建 yuqingDailyReport 执行器） */
    private boolean autoGenerate = false;

    /** 自动生成的报告类型：daily / monthly */
    private String autoType = "daily";

    /** 自动生成时使用的默认模板ID；为空则用系统内置无模板渲染 */
    private Long defaultTemplateId;

    /** 正文纳入的重点舆情条数上限 */
    private int hotOpinionLimit = 10;

    /** 正文纳入的预警条数上限 */
    private int alertLimit = 20;

    /** 是否在生成后自动推送至企业微信 */
    private boolean pushAfterGenerate = false;

    /** 启动时自检字体与渲染器可用性，缺依赖直接打 error 而非静默降级 */
    private boolean renderSelfCheck = true;

    /**
     * PDF 中文字体文件路径。
     *
     * <p>留空则由 {@code PdfRenderer} 按内置候选清单探测
     * （Windows 的 msyh.ttc / Linux 的 NotoSansCJK）。Linux 服务器上
     * 若用 Docker 精简镜像，务必显式配置本项或安装 fonts-noto-cjk，
     * 否则 PDF 导出会因找不到字体而明确失败。</p>
     */
    private String pdfFontPath;
}

package org.dromara.yuqing.ledger.domain;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 台账导出请求（F-016 验收标准 5、6）
 *
 * <p>验收标准 5 要求「按当前筛选条件导出 Excel，导出条数与字段范围可配置」。因此请求体携带：
 * 完整筛选条件（{@code query}）、要导出的字段（{@code columns}）、
 * 以及是否强制异步（{@code async}）。</p>
 *
 * <p><b>为什么 {@code columns} 允许为空：</b>空 = 导出全部可导出字段。
 * 真正的裁剪与白名单过滤在 {@code LedgerColumnCatalog.resolve} 完成 ——
 * 前端传什么都只是「意向」，最终列集合由服务端目录决定。</p>
 *
 * <p><b>{@code rowLimit} 的定位：</b>它不是「导出多少条」的授权手段，
 * 而是给用户在导出对话框里选择「只要前 N 条」的便利项。
 * 真正的硬上限（{@code maxExportRows}）与同步上限（{@code syncExportLimit}）
 * 由服务端配置控制，前端无法放宽。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerExportBo implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 筛选条件（与台账列表完全一致）。
     *
     * <p>刻意与列表共用 {@link LedgerQuery}：验收标准 5 要求「按当前筛选条件导出」，
     * 若两者字段集合不一致，「所见即所得」的导出就无从保证。</p>
     */
    @Valid
    @NotNull(message = "导出条件不能为空")
    private LedgerQuery query;

    /** 导出字段（空 = 全部可导出字段） */
    private List<String> columns;

    /** 是否强制走异步（用户在大数据量时可主动选异步，不等同步超时） */
    private Boolean async;

    /** 用户选择的「只导前 N 条」，空 = 不限制（仍受服务端硬上限约束） */
    private Integer rowLimit;

    /** 自定义文件名前缀（可选，服务端会再拼时间戳） */
    private String fileNamePrefix;

    /** 导出范围标识：ledger（台账）/ cluster（事件聚合），用于审计分类 */
    private String exportScope;
}

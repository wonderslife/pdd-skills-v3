package org.dromara.yuqing.ledger.export;

import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.yuqing.ledger.domain.LedgerRow;

import java.io.ByteArrayOutputStream;
import java.util.List;

/**
 * 台账 Excel 字节生成（F-016 验收标准 5）
 *
 * <p><b>为什么单独抽出来：</b>它没有数据库依赖、没有 Spring 依赖，
 * 因此可以在离线自测里真跑一遍（F016LedgerTest 会生成 xlsx 并断言
 * 文件头与列裁剪生效）。Excel 写出是最容易「改了一行没人发现」的地方 ——
 * 比如误用 EasyExcel 的注解包名，导出会静默变成没有表头的空表。</p>
 *
 * <p><b>列裁剪走 {@code ExcelBuilder.includeFields}：</b>入参 fields 已在
 * {@code LedgerColumnCatalog} 里过滤过白名单，这里只负责传给底层。
 * 同时开启 {@code orderByIncludeColumn}，让输出列顺序与目录声明顺序一致，
 * 而不是随机的字段反射顺序 —— 用户两次导出同样条件应得到同样列序。</p>
 *
 * @author ruoyi
 */
public final class LedgerExcelWriter {

    /** xlsx 的 MIME（异步上传到对象存储时作为 contentType） */
    public static final String MIME_XLSX =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private LedgerExcelWriter() {
    }

    /**
     * 生成 xlsx 字节。
     *
     * @param rows   数据行（可为空列表，此时产出一张只有表头的表 —— 这是刻意的：
     *               用户点了导出却得到 0 字节文件会更困惑）
     * @param fields 要导出的字段名（已过白名单）；为空则导出全部注解字段
     * @param sheetName 工作表名
     * @return xlsx 字节
     */
    public static byte[] write(List<LedgerRow> rows, List<String> fields, String sheetName) {
        ByteArrayOutputStream bos = new ByteArrayOutputStream(64 * 1024);
        String sheet = sheetName == null || sheetName.isBlank() ? "舆情台账" : sheetName;
        ExcelBuilder<LedgerRow> builder = ExcelBuilder
            .of(rows == null ? List.of() : rows, LedgerRow.class)
            .sheetName(sheet);
        if (fields != null && !fields.isEmpty()) {
            builder.includeFields(fields).orderByIncludeColumn(true);
        }
        builder.toStream(bos);
        return bos.toByteArray();
    }
}

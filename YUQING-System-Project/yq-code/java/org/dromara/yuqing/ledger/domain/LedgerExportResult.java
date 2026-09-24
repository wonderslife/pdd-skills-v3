package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 导出结果 / 异步任务状态（F-016 验收标准 6、10）
 *
 * <p>同步导出时不返回本对象（直接把 xlsx 写进响应流），
 * 异步导出时作为 JSON 返回，并被状态查询接口复用 ——
 * 这样前端只需一套类型即可同时处理「刚提交」与「轮询中」。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerExportResult implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 导出记录ID（异步任务凭此轮询） */
    private Long exportId;

    /** 导出方式：sync / async */
    private String mode;

    /** 任务状态：pending / running / success / failed */
    private String status;

    /** 导出条数（异步任务提交时为预估条数，完成后为实际条数） */
    private Integer rowCount;

    /** 导出字段数 */
    private Integer columnCount;

    /** 导出文件名 */
    private String fileName;

    /** 下载地址（异步任务完成后回填；同步导出为 null） */
    private String fileUrl;

    /** 完成时间 */
    private LocalDateTime finishTime;

    /** 失败原因 */
    private String failReason;

    /** 给用户看的说明（同步上限、转异步原因、下一步操作） */
    private String message;

    /** 本次生效的同步导出上限（前端用来解释「为什么转异步了」） */
    private Integer syncLimit;

    /** 数据范围说明（审计与提示用） */
    private String scopeDesc;
}

package org.dromara.yuqing.ledger.export;

/**
 * 台账导出完成推送场景（F-016 验收标准 6）
 *
 * <p>验收标准 6 要求异步导出「完成后推送下载链接」。推送链路复用 F-011 的
 * {@code PushDispatcher}，但场景取值必须是 {@code yq_push_scene} 字典里的成员，
 * 否则推送记录列表会显示裸编码。</p>
 *
 * <p><b>为什么不直接加在 F-011 的 {@code PushScene} 里：</b>那个文件归
 * {@code gen-yuqing-alert.mjs} 所有，F-016 从自己包里定义常量不构成归属抢占；
 * 字典取值本身已在 {@code gen-yuqing.mjs} 的 {@code yq_push_scene} 中登记。</p>
 *
 * @author ruoyi
 */
public final class LedgerPushScene {

    /** 台账导出完成 */
    public static final String EXPORT_READY = "ledger_export_ready";

    private LedgerPushScene() {
    }
}

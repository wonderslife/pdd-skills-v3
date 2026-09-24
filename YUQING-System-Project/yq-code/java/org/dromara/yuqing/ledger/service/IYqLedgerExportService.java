package org.dromara.yuqing.ledger.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqLedgerExportLog;
import org.dromara.yuqing.ledger.domain.LedgerExportBo;
import org.dromara.yuqing.ledger.domain.LedgerExportResult;

/**
 * 台账导出服务（F-016 验收标准 5、6、10）
 *
 * <p><b>为什么同步与异步共用一个入口：</b>验收标准 6 要求「超过配置上限时转为异步」——
 * 「是否转异步」是服务端依据条数上限做出的判断，不该由前端猜。若拆成
 * {@code /export} 与 {@code /exportAsync} 两个端点，前端就得先知道条数
 * （多一次请求）或猜错（要么白等同步超时、要么小数据量也走异步）。
 * 因此只留一个入口，响应体里的 {@code mode} 告诉前端走哪条路。</p>
 *
 * <p><b>下载方式统一为对象存储链接：</b>同步与异步都返回 {@code fileUrl}，
 * 前端只需「有链接就打开」这一套逻辑。同时导出文件不落应用服务器磁盘，
 * 天然规避了临时目录堆积与多实例部署下的「下载 404」。</p>
 *
 * @author ruoyi
 */
public interface IYqLedgerExportService {

    /**
     * 执行导出：小数据量同步返回下载链接，超限自动转异步任务。
     *
     * @param bo 导出请求（含筛选条件、字段范围、条数上限）
     * @return 导出结果；{@code mode} 为 {@code sync} 或 {@code async}
     */
    LedgerExportResult export(LedgerExportBo bo);

    /**
     * 查询异步导出任务状态（验收标准 6）
     *
     * <p>只允许查看自己发起的导出 —— 导出文件可能包含他人无权查看的筛选结果
     * 与下载链接，凭 exportId 就能取别人的文件属于越权。</p>
     */
    LedgerExportResult status(Long exportId);

    /**
     * 导出操作记录分页查询（验收标准 10）
     *
     * @param exportScope 按导出范围过滤（ledger / cluster），空则不过滤
     */
    PageResult<YqLedgerExportLog> logPage(PageQuery pageQuery, String exportScope);
}

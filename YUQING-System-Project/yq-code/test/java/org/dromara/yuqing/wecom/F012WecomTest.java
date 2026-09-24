package org.dromara.yuqing.wecom;

import org.dromara.yuqing.wecom.command.ParsedCommand;
import org.dromara.yuqing.wecom.command.WecomCommandParser;
import org.dromara.yuqing.wecom.command.WecomCommandType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * F-012 企微 H5 管控离线自测
 *
 * <p><b>为什么只测指令解析：</b>免登链路依赖企业微信真实网络接口与凭据，离线环境无法覆盖；
 * 而指令解析是纯函数（不碰 Spring / DB / 网络），是 F-012 里唯一可离线断言的部分。
 * 免登逻辑的正确性依赖联调，此处不假装覆盖。</p>
 *
 * @author ruoyi
 */
public class F012WecomTest {

    private final WecomCommandParser parser = new WecomCommandParser();

    private static final int MAX = 500;

    /* -------------------------------------------------- 指令类型识别 */

    @Test
    public void 建任务指令被识别为CREATE_TASK() {
        ParsedCommand c = parser.parse("帮我建一个关于台风的临时任务，到今晚8点", MAX);
        assertEquals(WecomCommandType.CREATE_TASK, c.type());
        assertTrue(c.recognized());
        assertTrue(c.confidence() > 0.5d, "命中关键词后置信度应高于基线");
    }

    @Test
    public void 查任务指令被识别为QUERY_TASK() {
        ParsedCommand c = parser.parse("查一下今天的采集任务进度", MAX);
        assertEquals(WecomCommandType.QUERY_TASK, c.type());
    }

    @Test
    public void 预警指令被识别为QUERY_ALERT() {
        ParsedCommand c = parser.parse("今天有哪些预警", MAX);
        assertEquals(WecomCommandType.QUERY_ALERT, c.type());
    }

    @Test
    public void 生成日报指令被识别为TRIGGER_REPORT() {
        ParsedCommand c = parser.parse("生成今天的日报", MAX);
        assertEquals(WecomCommandType.TRIGGER_REPORT, c.type());
    }

    @Test
    public void 生成月报指令被识别为TRIGGER_REPORT() {
        ParsedCommand c = parser.parse("出个月报", MAX);
        assertEquals(WecomCommandType.TRIGGER_REPORT, c.type());
    }

    @Test
    public void 研判指令被识别为TRIGGER_ANALYSIS() {
        ParsedCommand c = parser.parse("研判一下这条舆情", MAX);
        assertEquals(WecomCommandType.TRIGGER_ANALYSIS, c.type());
    }

    @Test
    public void 帮助指令被识别为HELP() {
        ParsedCommand c = parser.parse("帮助", MAX);
        assertEquals(WecomCommandType.HELP, c.type());
    }

    /* -------------------------------------------------- 边界与异常 */

    @Test
    public void 空指令被识别为UNKNOWN() {
        ParsedCommand c = parser.parse("", MAX);
        assertEquals(WecomCommandType.UNKNOWN, c.type());
        assertFalse(c.recognized());
    }

    @Test
    public void 空白指令被识别为UNKNOWN() {
        ParsedCommand c = parser.parse("   ", MAX);
        assertEquals(WecomCommandType.UNKNOWN, c.type());
    }

    @Test
    public void null指令不抛异常且识别为UNKNOWN() {
        ParsedCommand c = parser.parse(null, MAX);
        assertNotNull(c);
        assertEquals(WecomCommandType.UNKNOWN, c.type());
    }

    @Test
    public void 超长指令被拒绝且给出原因() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 600; i++) {
            sb.append('测');
        }
        ParsedCommand c = parser.parse(sb.toString(), MAX);
        assertEquals(WecomCommandType.UNKNOWN, c.type());
        assertTrue(c.params().containsKey("reason"), "超长应带原因");
    }

    @Test
    public void 无关键词文本被识别为UNKNOWN() {
        ParsedCommand c = parser.parse("今天天气不错", MAX);
        assertEquals(WecomCommandType.UNKNOWN, c.type());
    }

    /* -------------------------------------------------- 关键词抽取 */

    @Test
    public void 关于式建任务能抽出关键词() {
        ParsedCommand c = parser.parse("建一个关于台风的临时任务", MAX);
        assertEquals(WecomCommandType.CREATE_TASK, c.type());
        assertEquals("台风", c.keyword());
    }

    @Test
    public void 查询式指令能抽出关键词() {
        ParsedCommand c = parser.parse("查询一下新能源的舆情", MAX);
        assertNotNull(c.keyword());
        assertTrue(c.keyword().contains("新能源"));
    }

    @Test
    public void 结束时间表述被抽出为untilText() {
        ParsedCommand c = parser.parse("建个任务，到今晚8点结束", MAX);
        assertTrue(c.params().containsKey("untilText"), "应抽出结束时间原始表述");
    }

    @Test
    public void 未识别指令也保留抽到的参数() {
        // 行为契约：类型未识别 ≠ 参数全丢。
        // 实测踩坑：早期实现把「未识别则 return」放在参数抽取之前，
        // 连抽到的 untilText 都一起丢失，排查时看不到任何有用信息。
        ParsedCommand c = parser.parse("随便说点什么，到今晚8点", MAX);
        assertEquals(WecomCommandType.UNKNOWN, c.type());
        assertTrue(c.params().containsKey("untilText"), "未识别也应保留抽到的结束时间");
        assertTrue(c.params().containsKey("reason"), "未识别应带原因");
    }

    @Test
    public void 口语化建个任务也被识别() {
        // 「建个任务」比「建任务」更口语，用户实际输入更常带「个」
        ParsedCommand c = parser.parse("建个任务，盯一下台风", MAX);
        assertEquals(WecomCommandType.CREATE_TASK, c.type());
    }

    /* -------------------------------------------------- 行为守卫 */

    @Test
    public void 解析器只解析不执行_未识别类型不产生副作用() {
        // 只有 UNKNOWN 与 recognized 两种状态，不存在「悄悄执行」的第三态
        ParsedCommand c = parser.parse("随便说点什么", MAX);
        assertEquals(WecomCommandType.UNKNOWN, c.type());
        assertFalse(c.recognized());
    }

    @Test
    public void 未识别结果带reason便于排障() {
        ParsedCommand c = parser.parse("随便说点什么", MAX);
        assertTrue(c.params().containsKey("reason"));
        assertNotNull(c.params().get("reason"));
    }

    /* -------------------------------------------------- 枚举契约（前端字典依赖） */

    @Test
    public void 指令类型码值为稳定契约() {
        // H5 utils/yuqingDict.js 的 COMMAND_TYPE_MAP 依赖这些码值，改动即破坏前端展示
        assertEquals("unknown", WecomCommandType.UNKNOWN.getCode());
        assertEquals("query_task", WecomCommandType.QUERY_TASK.getCode());
        assertEquals("create_task", WecomCommandType.CREATE_TASK.getCode());
        assertEquals("query_alert", WecomCommandType.QUERY_ALERT.getCode());
        assertEquals("query_opinion", WecomCommandType.QUERY_OPINION.getCode());
        assertEquals("trigger_analysis", WecomCommandType.TRIGGER_ANALYSIS.getCode());
        assertEquals("trigger_report", WecomCommandType.TRIGGER_REPORT.getCode());
        assertEquals("help", WecomCommandType.HELP.getCode());
    }

    @Test
    public void 码值反查可还原类型() {
        assertEquals(WecomCommandType.CREATE_TASK, WecomCommandType.ofCode("create_task"));
        assertEquals(WecomCommandType.TRIGGER_REPORT, WecomCommandType.ofCode("trigger_report"));
    }

    @Test
    public void 未知码值反查回落UNKNOWN() {
        assertEquals(WecomCommandType.UNKNOWN, WecomCommandType.ofCode("not_a_type"));
        assertEquals(WecomCommandType.UNKNOWN, WecomCommandType.ofCode(null));
    }

    @Test
    public void 每个枚举项都有非空标签() {
        for (WecomCommandType t : WecomCommandType.values()) {
            assertNotNull(t.getLabel(), t.name() + " 缺少标签");
            assertFalse(t.getLabel().isBlank(), t.name() + " 标签为空");
        }
    }

    /* -------------------------------------------------- 成员信息载体 */

    @Test
    public void 非企业成员判定为false() {
        WecomMemberInfo external = new WecomMemberInfo(null, "openid_xx", null, null);
        assertFalse(external.isEnterpriseMember(), "无 UserId 应判为非企业成员");
    }

    @Test
    public void 企业成员判定为true() {
        WecomMemberInfo member = new WecomMemberInfo("zhangsan", null, null, null);
        assertTrue(member.isEnterpriseMember());
    }

    @Test
    public void 空UserId判为非企业成员() {
        WecomMemberInfo member = new WecomMemberInfo("  ", null, null, null);
        assertFalse(member.isEnterpriseMember());
    }

    @Test
    public void 免登异常携带用户可读原因() {
        WecomLoginException e = new WecomLoginException("该企业微信成员未绑定系统账号");
        assertEquals("该企业微信成员未绑定系统账号", e.getMessage());
    }

    @Test
    public void 解析结果不可为null() {
        assertNotNull(parser.parse("任意文本", MAX));
        assertNotNull(parser.parse("", MAX));
        assertNotNull(parser.parse(null, MAX));
    }

    @Test
    public void 命中关键词时params带hitWord() {
        ParsedCommand c = parser.parse("查一下预警", MAX);
        assertTrue(c.params().containsKey("hitWord"));
    }

    @Test
    public void 非关键词指令params无keyword但当有reason() {
        ParsedCommand c = parser.parse("嗯嗯啊啊", MAX);
        assertNull(c.keyword());
        assertTrue(c.params().containsKey("reason"));
    }
}

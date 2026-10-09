package org.dromara.yuqing.collect;

import org.dromara.yuqing.collect.keyword.KeywordExpression;
import org.dromara.yuqing.collect.keyword.KeywordImportItem;
import org.dromara.yuqing.collect.keyword.KeywordImportParser;
import org.dromara.yuqing.collect.keyword.KeywordImportResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 词表导入解析离线自测（P0-4）。
 *
 * <p>样例原文取自业务同事真实提交的《关键词样例.txt》，数量为脚本实测值：
 * 组合 2 条、排除词原始 188 条 → 去重 177 条（跳过 11 条）、检索请求 10 次。</p>
 *
 * @author ruoyi
 */
@Tag("dev")
@DisplayName("词表导入解析")
class YqKeywordImportTest {

    /** 业务同事真实样例原文 */
    private static final String SAMPLE = """
样例1：
(辽宁|沈阳|大连|鞍山|抚顺|本溪|丹东|锦州|营口|阜新|辽阳|盘锦|铁岭|朝阳市|葫芦岛|沈抚)+(药监局|药品|医疗器械|化妆品|服务区|药品监督)
样例2：
((东北|东三省|辽吉黑内蒙|东北四省|东北三省)+(地区城市足球联赛|东北足球超级联赛|东北区域城市足球联赛|东北超))

排除：

国事访问|被查|离职|妈妈|超厚|爆款|套餐|超级大串|超实在|湖南|司机|吴石|鲲鹏|亚太经合组织|四川|梅西|日本|新基建|鹤城|艺术|美国|文革|粉条|超市|东北超大卷饼|批发二手车|东北超哥|东北超值|东北超哥|东北超长|东北超赞|东南东北|手工饺子|东北部|云南省城市足球联赛|江苏城市足球联赛|东北超22号楼|东北超自然|东北超过|东北超绝|东北杯|东北超拽|东北超轻|上架天东北超|上架天“东北超”|东北超10|东北面|渝东北三峡库|江苏省城市足球联赛|渝东北|海南省城市足球联赛|东北超力|东北超保暖|省足球联赛育儿|外穿东北超|东北超杀女|东北超大|东北超火|扬州市城市足球联赛|中国职工足球联赛|没法去东北|东北超火|东北超小众|东北超小|东北超暖|卢浮宫“东北超”|东北超火|外穿东北超|“东北超”值得违法”|超级无敌|东北超姐|超级铁饭碗|东北超体|天鹅新闻|东北超人|东北超米|超级大省|东北超越|东北超jsn|东北超神|东北超低|东北超薄|东北超姐|东北超省心|东北超爷|东北超棒|东北侧|东北超酱|东北超踢|东北超广角|东北安日烧烤|东北超干燥|巴西足球联赛|东北超鲁西南|东北超甜|东北超歌|广西|东北超喜欢|东北超人|东北大汉|加绒加厚|东北超级冷|东北超出片|超出片|超级邪|超级大西瓜|肖战|东北超冷|东北超远|东北超冷|超乎想象|县长杯|超级恶劣|排骨米饭|超级恶劣|超级好品质|超级大|超级像|酱大骨|超级近|超级下饭菜|超级好玩|东华杯|定南|超推荐|更在乎记录这一瞬间的意义|超级老妈|注定无人能懂|超粉|超美景色|英姿|超盖浇饭|孔城中心小学|安徽省青少年|超吨车|东北角|长江大学足球联赛|超爱|超前|东北甜妹|东北师范大学|湘超足球联赛|东北80米|东北超软|w25170055|zhc55555555|超级水区|超级水区|仔细想想守门带给了我什么|赵昭仪|东北风|苏州卓越高校校友联盟足球联赛|超划算春饼|中国足球联赛|足球联赛的规则|超需要|东北抖音号|校园足球联赛|超级舞蹈|东北菜|学生足球联赛|超强音|超嗷嗷叫|超雄甜美|超级豆人|淮安市城市足球联赛|东北超超|东北姐弟恋|淮安市城市足球联赛|”县区足球联赛宿城队|超音速|青少年足球联赛|超恶|超多门店|超解腻|超级特产|超4万斤|超多景点|超货纳|超好吃|超级特产|超深桩基工程|东北路小学|超有市井气息|超巨型盖浇饭|超级小町|超难超长句|超美童话小镇
""";

    @Test
    @DisplayName("真实样例：2 条组合 + 177 条排除 + 跳过 11 条重复")
    void parseRealSample() {
        KeywordImportResult result = KeywordImportParser.parse(SAMPLE);
        assertTrue(result.isOk(), () -> "真实样例应无语法错误，实际：" + result.getErrors());
        assertEquals(2, result.getComboCount(), "组合表达式条数");
        assertEquals(177, result.getNegativeCount(), "去重后排除词条数");
        assertEquals(0, result.getPlainCount(), "普通词条数");
        assertEquals(11, result.getDuplicateCount(), "重复跳过条数");
        assertEquals(179, result.getItems().size(), "待入库条目总数");
        assertEquals(10, result.getSearchTermCount(), "检索请求次数（6 + 4）");
    }

    @Test
    @DisplayName("样例2：整段外层括号被自动剥离，不再报「不支持嵌套括号」")
    void redundantOuterParensAreStripped() {
        String raw = "((东北|东三省|辽吉黑内蒙|东北四省|东北三省)+(地区城市足球联赛|东北足球超级联赛|东北区域城市足球联赛|东北超))";
        assertTrue(raw.startsWith("(("), "原始写法应带多层外层括号");

        List<String> issues = KeywordExpression.validate(raw);
        assertTrue(issues.isEmpty(), () -> "外层括号应被剥离：" + issues);

        KeywordExpression parsed = KeywordExpression.parse(raw);
        assertEquals(2, parsed.getGroups().size(), "组数");
        assertEquals(List.of("东北", "东三省", "辽吉黑内蒙", "东北四省", "东北三省"), parsed.getGroups().get(0));
        assertEquals(List.of("地区城市足球联赛", "东北足球超级联赛", "东北区域城市足球联赛", "东北超"), parsed.primaryGroup());

        /* 归一化结果必须洗干净：既不留外层括号，也不留前后空白（否则 keyword_text 会脏、去重失效） */
        assertEquals("(东北|东三省|辽吉黑内蒙|东北四省|东北三省)+(地区城市足球联赛|东北足球超级联赛|东北区域城市足球联赛|东北超)", parsed.getNormalized());
    }

    @Test
    @DisplayName("非冗余的嵌套括号仍判定为语法错误")
    void nestedParensStillRejected() {
        List<String> issues = KeywordExpression.validate("((A|B)+(C|D))+(E|F)");
        assertFalse(issues.isEmpty(), "首括号中途闭合，不属于「整段外层括号」");
        assertTrue(issues.get(0).contains("嵌套"), issues.get(0));
    }

    @Test
    @DisplayName("只含排除词的表达式被拒绝")
    void excludeOnlyExpressionRejected() {
        List<String> issues = KeywordExpression.validate("-(广告|代理)");
        assertFalse(issues.isEmpty());
        assertTrue(issues.get(0).contains("缺少检索词组"), issues.get(0));
    }

    @Test
    @DisplayName("表达式内联排除段同时登记为排除词条目")
    void inlineExcludesBecomeNegativeItems() {
        KeywordImportResult result = KeywordImportParser.parse("样例:(东北超|辽超)+(足球联赛)-(广告|代理|招聘)");
        assertTrue(result.isOk(), () -> String.valueOf(result.getErrors()));
        assertEquals(1, result.getComboCount());
        assertEquals(3, result.getNegativeCount());
        assertEquals(3, result.getInlineExcludeCount());
        assertTrue(result.getItems().stream()
            .anyMatch(i -> "广告".equals(i.getKeywordText()) && i.isInlineExclude()));
    }

    @Test
    @DisplayName("排除词段支持换行分隔")
    void excludeSectionSupportsNewlineSeparated() {
        String text = """
排除:
广告
代理
招聘
""";
        KeywordImportResult result = KeywordImportParser.parse(text);
        assertTrue(result.isOk(), () -> String.valueOf(result.getErrors()));
        assertEquals(3, result.getNegativeCount());
    }

    @Test
    @DisplayName("与段落标记同形的普通词不会被误吞")
    void markerLookalikeIsNotSwallowed() {
        String text = """
例
排除率
排除:
广告|代理
""";
        KeywordImportResult result = KeywordImportParser.parse(text);
        assertTrue(result.isOk(), () -> String.valueOf(result.getErrors()));
        assertEquals(2, result.getPlainCount(), "「例」「排除率」应作为普通词");
        assertEquals(2, result.getNegativeCount(), "「排除:」之后才是排除词段");
    }

    @Test
    @DisplayName("段落标记行只在独占一行时生效，行内标题走剥离逻辑")
    void leadingLabelIsStripped() {
        String text = """
药监监测:(辽宁|沈阳)+(药监局|药品)
时间:12:30
""";
        KeywordImportResult result = KeywordImportParser.parse(text);
        assertTrue(result.isOk(), () -> String.valueOf(result.getErrors()));
        assertEquals(1, result.getComboCount(), "带标题的组合表达式应被识别");
        assertEquals(1, result.getPlainCount(), "含冒号的普通词不应被当成标题");
        assertEquals("时间:12:30", result.plains().get(0).getKeywordText());
        assertTrue(result.combos().get(0).getRemark().contains("药监监测"),
            "标题应写进备注，便于回溯来源：" + result.combos().get(0).getRemark());
    }

    @Test
    @DisplayName("超过 keyword_text 列宽的表达式报错而不是静默截断")
    void tooLongExpressionIsRejected() {
        StringBuilder builder = new StringBuilder("(");
        for (int i = 0; builder.length() < 60; i++) {
            if (i > 0) {
                builder.append('|');
            }
            builder.append("地区").append(i);
        }
        builder.append(")+(");
        for (int i = 0; builder.length() < 130; i++) {
            if (i > 0) {
                builder.append('|');
            }
            builder.append("主题").append(i);
        }
        builder.append(')');
        KeywordImportResult result = KeywordImportParser.parse(builder.toString());
        assertFalse(result.isOk(), "超长表达式应报错");
        assertTrue(result.getErrors().get(0).contains("列宽"), result.getErrors().get(0));
    }

    @Test
    @DisplayName("空内容报错，不返回空成功")
    void blankInputRejected() {
        assertFalse(KeywordImportParser.parse("").isOk());
        assertFalse(KeywordImportParser.parse("   ").isOk());
    }

    @Test
    @DisplayName("组合表达式只以最后一组作为检索词（不放大检索请求）")
    void lastGroupIsSearchGroup() {
        KeywordImportResult result = KeywordImportParser.parse(SAMPLE);
        KeywordImportItem first = result.combos().get(0);
        assertEquals(6, first.getSearchTerms().size(), "样例1 检索词应为 6 个主题词");
        assertEquals(2, first.getGroupCount());
        assertEquals(22, first.getWordCount());
    }
}

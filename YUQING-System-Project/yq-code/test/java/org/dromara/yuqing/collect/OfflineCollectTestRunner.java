package org.dromara.yuqing.collect;

import java.lang.annotation.Annotation;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * F-004 采集引擎离线自测执行器。
 *
 * <p><b>为什么需要它：</b>本工程父 pom 设了 {@code <maven.test.skip>true</maven.test.skip>}，
 * 且 surefire 的 JUnit Platform provider（{@code surefire-junit-platform}）在离线仓库中
 * 只有 2.22.2 版本，与 Spring Boot 4.1 / JUnit 6 不兼容 —— 直接 {@code mvn test} 会以
 * 「artifact not found」告终。本类用反射直接执行 {@link #TARGETS} 中所有带
 * {@code @Test} 的方法，给出一个不依赖 surefire 的执行入口。</p>
 *
 * <p><b>用法：</b></p>
 * <pre>
 * java -cp "target/test-classes;target/classes;&lt;依赖 jar 列表&gt;" \
 *      org.dromara.yuqing.collect.OfflineCollectTestRunner
 * </pre>
 *
 * <p>反射按注解全限定名判断而不 import JUnit，因此本类在 JUnit 缺席时同样可编译；
 * 每个用例都新建实例调用，等价于 JUnit 的默认 {@code PER_METHOD} 生命周期。</p>
 *
 * @author ruoyi
 */
public final class OfflineCollectTestRunner {

    /** JUnit 5 测试注解的全限定名（字符串比较，避免硬依赖）。 */
    private static final String TEST_ANNOTATION = "org.junit.jupiter.api.Test";

    /** 纳入离线执行的测试类（本机 surefire 跑不动 JUnit 6，这里显式登记） */
    private static final Class<?>[] TARGETS = {
        YqCollectEngineTest.class,
        YqKeywordPipelineTest.class,
        YqKeywordImportTest.class,
        F006CleanTest.class,
        org.dromara.yuqing.alert.F010AlertPushTest.class,
        org.dromara.yuqing.analytics.F009AnalyticsTest.class,
        org.dromara.yuqing.wecom.F012WecomTest.class,
        org.dromara.yuqing.report.F014ReportTest.class,
        org.dromara.yuqing.ledger.F016LedgerTest.class,
        org.dromara.yuqing.analysis.F007AnalysisTest.class,
    };

    private OfflineCollectTestRunner() {
    }

    public static void main(String[] args) {
        List<String> failures = new ArrayList<>();
        int pass = 0;
        int total = 0;
        System.out.println("======== F-004 采集 / 关键词 / 净化 / 预警推送 / 多维分析 / 企微H5 / 日报生成 / 舆情台账 / 智能研判 离线自测 ========");
        for (Class<?> target : TARGETS) {
            List<Method> methods = testMethods(target);
            total += methods.size();
            System.out.println();
            System.out.println("-- " + target.getSimpleName() + "（" + methods.size() + " 用例）");
            for (Method method : methods) {
                method.setAccessible(true);
                String label = target.getSimpleName() + "." + method.getName();
                try {
                    Object instance = target.getDeclaredConstructor().newInstance();
                    method.invoke(instance);
                    System.out.println("  [PASS] " + label);
                    pass++;
                } catch (InvocationTargetException e) {
                    Throwable cause = e.getCause() == null ? e : e.getCause();
                    String msg = cause.toString();
                    System.out.println("  [FAIL] " + label + "  -> " + msg);
                    for (StackTraceElement el : cause.getStackTrace()) {
                        if (el.getClassName().startsWith("org.dromara.yuqing")) {
                            System.out.println("           at " + el);
                        }
                    }
                    failures.add(label + ": " + msg);
                } catch (ReflectiveOperationException e) {
                    System.out.println("  [FAIL] " + label + "  -> 反射调用失败: " + e);
                    failures.add(label + ": " + e);
                }
            }
        }

        System.out.println();
        System.out.println("================ 结果: 通过 " + pass + " / 失败 " + failures.size()
            + "  （共 " + total + " 用例）=================");
        for (String f : failures) {
            System.out.println("  - " + f);
        }
        if (!failures.isEmpty()) {
            System.exit(1);
        }
    }

    /**
     * 取出带 {@code @Test} 注解的方法（按注解全限定名判断，不 import JUnit）。
     *
     * @param target 测试类
     * @return 方法列表，按名称排序
     */
    private static List<Method> testMethods(Class<?> target) {
        List<Method> methods = new ArrayList<>();
        for (Method method : target.getDeclaredMethods()) {
            for (Annotation annotation : method.getAnnotations()) {
                if (TEST_ANNOTATION.equals(annotation.annotationType().getName())) {
                    methods.add(method);
                    break;
                }
            }
        }
        methods.sort(Comparator.comparing(Method::getName));
        return methods;
    }
}

# 历史发布包迁移与版本管理

本阶段只盘点、提供建议命令和维护工具；没有创建tag、上传Release、删除history或重写Git历史。素材权属未完成前，不自动公开上传历史包。

## 历史ZIP

版本来自ZIP内src/data.js，不仅依赖文件名。每份原始包保留，SHA-256用于未来上传后校验。

| ZIP | 内部版本 | 字节 / MiB | SHA-256 |
| --- | --- | --- | --- |
| history/xian-emperor-simulator-v1.6.0.zip | 1.6.0 | 29521322 / 28.15 | cbca0aa818face79d62b3871310158dab3a24bc5c4dd5a4238af2ec467938445 |
| history/xian-emperor-simulator-v1.7.0.zip | 1.7.0 | 29526836 / 28.16 | 00fead7522dba9b1a4b779500707e6548e7e60eae2007b6f365e7f334ee57b83 |
| history/xian-emperor-simulator-v1.8.0.zip | 1.8.0 | 29532077 / 28.16 | 2c3e2ef24e3ec1358274375fe45d94d37f15a2819e8ececf1dd2d6dbd3c46423 |
| history/xian-emperor-simulator-v1.9.0.zip | 1.9.0 | 29537929 / 28.17 | 947050c0b320611ba60d913fce3b10c019cc5c2719d3d9af1371d419ddb9db97 |
| history/xian-emperor-simulator-v2.0.0.zip | 2.0.0 | 29548309 / 28.18 | ac87f0c0ff466854fcc8781fe32877f7f0bddc7ffa25c2dbd54b7e29c36c0dba |
| history/xian-emperor-simulator-v2.1.0.zip | 2.1.0 | 29554646 / 28.19 | 4e930feeef44ec86a179a13a33aa807d51cecddef319a9682f20d6abc9008418 |
| history/xian-emperor-simulator-v2.2.0.zip | 2.2.0 | 29560028 / 28.19 | 64746a2a6bde5f8e538afc78dcdb076114cf6995b79620428766827fe1b2fbc9 |
| history/xian-emperor-simulator-v2.3.0.zip | 2.3.0 | 29567376 / 28.20 | 5b00e6cb4c258e09daecd82bfd437fe85f743db75a7e032c3d4c3f3a1382c15b |
| history/xian-emperor-simulator-v2.4.0.zip | 2.4.0 | 29573068 / 28.20 | 6f5b8b01332d57c9f7caba3980762aa06ba72a973972e74e65f797152cded21f |
| history/xian-emperor-simulator-v2.5.0.zip | 2.5.0 | 29584759 / 28.21 | 35fb16aefaa0dc38be44ee726d147cf558225c0013e7683e9bef971d6c63e581 |
| history/xian-emperor-simulator-v2.6.0.zip | 2.6.0 | 29591531 / 28.22 | 08490c235229aa91121938207a7c87fd81e8c6cd91a4dbd87e5ee560bad1bd73 |
| history/xian-emperor-simulator-v2.6.1.zip | 2.6.1 | 29596714 / 28.23 | d56ca41a576f2939f49cfcff8b01e6a70109005003631369c43c514fefc07ff4 |
| history/xian-emperor-simulator-v2.7.0.zip | 2.7.0 | 30317985 / 28.91 | bfdc7a117549c331bd92f08620634cc505489c8d22fd4060ef09c300cec51204 |
| history/xian-emperor-simulator-v2.7.1.zip | 2.7.1 | 31770732 / 30.30 | 27906584b7498f48f9759bf5074425552853dda8235c5ee9aeadbfeeaf2f9a82 |
| history/xian-emperor-simulator-v2.7.2.zip | 2.7.2 | 31775109 / 30.30 | 4abfbf02b9e3a9399f60465bb96b8594eda6fd2c3b14c3048cf3633100f40f28 |
| history/xian-emperor-simulator-v2.8.0.zip | 2.8.0 | 32318065 / 30.82 | df9a08bf3bd11b3171aff259a29223676dfa20bd7aa997be47885db8f5753c8b |
| history/xian-emperor-simulator-v2.9.0.zip | 2.9.0 | 32350840 / 30.85 | c38d178d7aecf1f9126d8e885ac838e4bab93a971708c0501a11629f5b868b8e |
| history/xian-emperor-simulator-v2.10.0.zip | 2.10.0 | 32360716 / 30.86 | 24e26642ec706e5ca375bb0ea7fd7ed8de5ee46da7a5c5521531aaed93457257 |
| history/xian-emperor-simulator-v2.11.0.zip | 2.11.0 | 32368037 / 30.87 | 26e9f4a2cbed76fa5bcd2bf3e2e4ebf9ea3c3b0174eb8edbed5c1811862d98eb |
| history/xian-emperor-simulator-v2.12.0.zip | 2.12.0 | 32375670 / 30.88 | 2ff52c50696e752943e6f8c1bad412ae2fba44e838cca713346d44136153a377 |
| history/xian-emperor-simulator-v2.13.0.zip | 2.13.0 | 32386638 / 30.89 | e99231d560d7abe7b0a0bd5f574c5842f47c26edf54a527ae45316b6250339ae |

## tag建议命令

以下SHA必须由所有者先核对为对应版本的源码提交，不能拿当前main给所有旧版打tag；没有确认到源码提交的版本保持TODO。若当年未提交源码，应在隔离目录恢复ZIP，检查后形成对应的归档提交，再替换占位。以下命令未执行。

~~~text
git tag -a v1.6.0 <已核对的v1.6.0源码提交SHA> -m "v1.6.0 历史发布"
git tag -a v1.7.0 <已核对的v1.7.0源码提交SHA> -m "v1.7.0 历史发布"
git tag -a v1.8.0 <已核对的v1.8.0源码提交SHA> -m "v1.8.0 历史发布"
git tag -a v1.9.0 <已核对的v1.9.0源码提交SHA> -m "v1.9.0 历史发布"
git tag -a v2.0.0 <已核对的v2.0.0源码提交SHA> -m "v2.0.0 历史发布"
git tag -a v2.1.0 <已核对的v2.1.0源码提交SHA> -m "v2.1.0 历史发布"
git tag -a v2.2.0 <已核对的v2.2.0源码提交SHA> -m "v2.2.0 历史发布"
git tag -a v2.3.0 <已核对的v2.3.0源码提交SHA> -m "v2.3.0 历史发布"
git tag -a v2.4.0 <已核对的v2.4.0源码提交SHA> -m "v2.4.0 历史发布"
git tag -a v2.5.0 <已核对的v2.5.0源码提交SHA> -m "v2.5.0 历史发布"
git tag -a v2.6.0 <已核对的v2.6.0源码提交SHA> -m "v2.6.0 历史发布"
git tag -a v2.6.1 <已核对的v2.6.1源码提交SHA> -m "v2.6.1 历史发布"
git tag -a v2.7.0 <已核对的v2.7.0源码提交SHA> -m "v2.7.0 历史发布"
git tag -a v2.7.1 <已核对的v2.7.1源码提交SHA> -m "v2.7.1 历史发布"
git tag -a v2.7.2 <已核对的v2.7.2源码提交SHA> -m "v2.7.2 历史发布"
git tag -a v2.8.0 <已核对的v2.8.0源码提交SHA> -m "v2.8.0 历史发布"
git tag -a v2.9.0 <已核对的v2.9.0源码提交SHA> -m "v2.9.0 历史发布"
git tag -a v2.10.0 <已核对的v2.10.0源码提交SHA> -m "v2.10.0 历史发布"
git tag -a v2.11.0 <已核对的v2.11.0源码提交SHA> -m "v2.11.0 历史发布"
git tag -a v2.12.0 <已核对的v2.12.0源码提交SHA> -m "v2.12.0 历史发布"
git tag -a v2.13.0 <已核对的v2.13.0源码提交SHA> -m "v2.13.0 历史发布"
~~~

## 迁移步骤

1. 由所有者完成CREDITS中待补授权，尤其音乐与历史包内素材，并备份仓库refs及全部ZIP。
2. 逐版本确认源码提交，审核上述tag计划；本轮不自行选择提交或创建标签。
3. 在GitHub Releases按对应tag上传原ZIP附件，逐份下载并比对本表SHA-256、版本与可运行性。
4. **在GitHub Releases上传ZIP附件并确认校验后，再由所有者决定删除history/，并从仓库Git历史外迁移。**
5. 删除当前目录和清理旧Git对象是两项不同操作。仅删除工作树目录不会缩小旧提交中的ZIP。
6. 若所有者选择历史重写，应在独立完整镜像上演练过滤history路径，检查标签/分支、测试并备份后协调强制更新及其他克隆重建。当前检出使用共享对象库，不能直接手删对象文件。
7. 历史重写、强制推送、清理旧对象与素材对外发布均未执行，需单独决策。

## 产品版本来源与一条命令更新

产品唯一事实来源是src/data.js的GAME_DATA.version。scripts/read-version.cjs读取该值，统一检查及发布回归默认使用该值；EXPECTED_VERSION仅作显式覆盖。

~~~text
node scripts/read-version.cjs
node scripts/bump-version.cjs 2.30.1 --notes-file <变更说明文件> --dry-run
node scripts/bump-version.cjs 2.30.1 --notes-file <变更说明文件>
~~~

2.30.1仅为使用示例，本轮没有实际升级版本。脚本预先验证全部目标，写入失败尝试恢复原文件；拒绝覆盖已有目标版本说明。没有提供说明时写TODO，不能把TODO当成已完成的发布记录。

同步范围：产品常量、index当前发布批次的标题/缓存参数、README当前摘要、CHANGELOG新条目、独立patch-note、工作流发布门禁与发布回归中的当前版本引用。保持?v=格式，保留未属于当前批次的旧模块缓存标签。

不自动修改：rulesVersion=230、核心schemaVersion=103、localStorage键、模块持久化version、历史条目及素材。产品升级不代表规则或存档版本变化；游戏规则变更必须另外评估。

静态手写版本清单见[VERSION_INVENTORY.md](VERSION_INVENTORY.md)。参与约定见[CONTRIBUTING](../CONTRIBUTING.md)。

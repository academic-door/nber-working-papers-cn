# 学术传送门 NBER 工作论文

面向中文读者的 NBER Working Papers 非官方整理项目，提供最新周报、月度中文合集、论文检索与研究专题浏览。

**网站入口：** [https://academic-door.github.io/nber-working-papers-cn/](https://academic-door.github.io/nber-working-papers-cn/)

## 主要内容

- 每周一自动更新 NBER Working Papers。
- 周报采用 NBER 官方公开数据的完整批次。
- 提供英文标题、中文标题、作者、英文摘要和中文摘要。
- 支持按年份、主题和中国相关研究进行检索。
- 提供 [RSS](https://academic-door.github.io/nber-working-papers-cn/feed.xml) 与 [JSON Feed](https://academic-door.github.io/nber-working-papers-cn/feed.json) 订阅。

## 数据来源

本站基于 NBER Working Papers 官方公开数据整理生成。论文原文、版本更新、引用格式和版权信息请以 [NBER 官网](https://www.nber.org/papers) 为准。

## 免责声明

本站由 Academic Door / 学术传送门维护，是面向中文读者的非官方、非营利学术交流项目，致力于提供便于检索、阅读与传播的学术公共品。中文标题与摘要由 AI 辅助翻译并经人工整理，仍可能存在疏漏；论文内容、版本及版权信息请以 [NBER 官网](https://www.nber.org/papers) 和论文原文为准。

## 公众号

关注微信公众号：**学术传送门**，获取最新前沿文献，读好文献，用好论文！

<p align="center">
  <img src="assets/academic-door-qr.jpg" alt="学术传送门微信公众号二维码" width="180">
</p>


## Production execution boundary

This public repository is also the GitHub-hosted execution surface for the NBER release-critical production path.

Private production/source authority remains outside this public repository. The public workflow checks out the private production worktree at runtime using a least-privilege cross-repository credential, executes the private pipeline code, persists accepted private state back to its private authority, and publishes only the already-public static site to this repository's `gh-pages` branch.

Production credentials are available only to default-branch `schedule` / `workflow_dispatch` runs. Pull-request and fork workflows are not production triggers and do not receive the production credential.

The public execution workflow does not upload private delivery/cache/source artifacts.

Credentialed smoke validation is performed on the migration branch before production cutover.
<!-- NBER public-runner production cutover verified against private main; see pipeline issue #94. -->

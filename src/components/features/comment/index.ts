/**
 * 评论域的对外出口。
 * ---------------------------------------------------------------------------
 * 其他功能域（`dynamic` / `guestbook`）只从这里拿东西，不深挖内部文件 ——
 * 否则两个领域就被焊死，删一个功能要顺着 import 找三处。
 *
 * 两条约束：
 *   1. 需要 `client:*` 水合的组件，请在页面里直接 import 具体文件，不要经过这个桶
 *      （水合判定要看到真实的组件模块）；
 *   2. 新增导出前先问：这真是「评论对外的能力」，还是只是本域内部实现？
 */

export { default as Comment } from "./Comment.astro";
export { default as CommentSkeleton } from "./CommentSkeleton.astro";
export { default as PostComments } from "./PostComments.astro";

export * from "./comment-own";
export * from "./comment-user";
export * from "./comment-drawer";

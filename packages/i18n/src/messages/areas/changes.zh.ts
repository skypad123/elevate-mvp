import type { changesEn } from './changes.en'

export const changesZh = {
  'changes.back': '返回课程',
  'changes.loadFailed': '无法加载更改',
  'changes.eyebrow': '待批准的更改',
  'changes.description': '撰稿人对这门已上线课程所做的修改。在获得批准之前，学员不会看到这些修改。',
  'changes.none.title': '暂无待处理的更改',
  'changes.none.body': '这门课程没有等待批准的更改。',
  'changes.none.open': '打开课程',

  'changes.writer.unknown': '撰稿人',

  'changes.clashes.title.one': '与已上线课程有 {count} 处冲突',
  'changes.clashes.title.other': '与已上线课程有 {count} 处冲突',
  'changes.clashes.description':
    '{writer} 开始编辑后，已上线课程又有了更改。请为每处冲突选择要保留的版本。两个版本不会合并。',

  'changes.clash.prerequisites.story':
    '“{title}”的先修课时在已上线课程中被更改了，{writer} 也做了更改。',
  'changes.clash.prerequisites.keepLive': '保留已上线的先修课时',
  'changes.clash.prerequisites.keepDraft': '采用 {writer} 的先修课时',
  'changes.clash.deleted.story.lesson':
    '{writer} 开始编辑后，已上线课程中的课时“{title}”被删除了。',
  'changes.clash.deleted.story.artefact':
    '{writer} 开始编辑后，已上线课程中的内容“{title}”被删除了。',
  'changes.clash.deleted.story.quiz': '{writer} 开始编辑后，已上线课程中的测验“{title}”被删除了。',
  'changes.clash.deleted.keepLive': '保持删除',
  'changes.clash.deleted.keepDraft': '恢复它，并采用 {writer} 的更改',
  'changes.clash.deleted.dropped.one': '保持删除还会丢弃 {writer} 在其中新增的 {count} 项内容。',
  'changes.clash.deleted.dropped.other': '保持删除还会丢弃 {writer} 在其中新增的 {count} 项内容。',
  'changes.clash.removed.story.lesson':
    '{writer} 移除了课时“{title}”，但此后它在已上线课程中被修改过。',
  'changes.clash.removed.story.artefact':
    '{writer} 移除了内容“{title}”，但此后它在已上线课程中被修改过。',
  'changes.clash.removed.story.quiz':
    '{writer} 移除了测验“{title}”，但此后它在已上线课程中被修改过。',
  'changes.clash.removed.keepLive': '保留它，沿用已上线版本',
  'changes.clash.removed.keepDraft': '移除它',
  'changes.clash.edited.story.lesson':
    '{writer} 开始编辑后，已上线课程中的课时“{title}”也被修改了。',
  'changes.clash.edited.story.artefact':
    '{writer} 开始编辑后，已上线课程中的内容“{title}”也被修改了。',
  'changes.clash.edited.story.quiz': '{writer} 开始编辑后，已上线课程中的测验“{title}”也被修改了。',
  'changes.clash.edited.keepLive': '保留已上线版本',
  'changes.clash.edited.keepDraft': '采用 {writer} 的版本',
  'changes.clash.noChoice': '尚未选择。',

  'changes.versions.label': '两个版本',
  'changes.versions.theirs': '{writer} 的版本',

  'changes.count.one': '{count} 项更改',
  'changes.count.other': '{count} 项更改',
  'changes.empty.title': '尚无更改',
  'changes.empty.body':
    '{writer} 已开始编辑这门课程，但还没有做任何更改。您可以放弃这次编辑，也可以再等等。',
  'changes.change.added': '新增',
  'changes.change.edited': '修改',
  'changes.change.removed': '移除',
  'changes.kind.lesson': '课时',
  'changes.kind.artefact': '内容',
  'changes.kind.quiz': '测验题目',
  'changes.kind.prerequisites': '先修课时',

  'changes.lesson.added': '新增课时，其中的内容列在下方。',
  'changes.lesson.added.withSummary': '新增课时：{summary}。其中的内容列在下方。',
  'changes.lesson.removed.one':
    '该课时及其中的 {count} 项内容会被移除，学员相应的学习进度也将丢失。',
  'changes.lesson.removed.other':
    '该课时及其中的 {count} 项内容会被移除，学员相应的学习进度也将丢失。',
  'changes.field.title': '标题',
  'changes.field.summary': '简介',
  'changes.field.lessonPosition': '在课程中的位置',
  'changes.position.lesson': '第 {n} 课时',

  'changes.field.prerequisites': '完成以下课时后解锁',
  'changes.prerequisites.unknownLesson': '另一个课时',
  'changes.prerequisites.none': '无：从一开始就开放',

  'changes.field.questions': '题目',

  'changes.item.removed.video': '该视频会被移除，学员相应的学习进度也将丢失。',
  'changes.item.removed.audio': '该音频会被移除，学员相应的学习进度也将丢失。',
  'changes.item.removed.text': '该阅读材料会被移除，学员相应的学习进度也将丢失。',
  'changes.item.removed.quiz': '该测验会被移除，学员相应的学习进度也将丢失。',
  'changes.item.removed.unknown': '该内容会被移除，学员相应的学习进度也将丢失。',
  'changes.item.added.video': '新增视频。',
  'changes.item.added.audio': '新增音频。',
  'changes.item.added.text': '新增阅读材料。',
  'changes.item.added.quiz': '新增测验。',
  'changes.field.itemPosition': '在课时中的位置',
  'changes.position.item': '第 {n} 项内容',
  'changes.field.file': '文件',
  'changes.file.none': '无文件',
  'changes.field.text': '正文',

  'changes.compare.live': '当前已上线',
  'changes.compare.afterApproval': '批准后',

  'changes.body.noText': '尚无正文。',
  'changes.body.file': '文件：{filename}',
  'changes.body.noFile': '尚未上传文件。',

  'changes.quiz.noQuestions': '没有题目。',
  'changes.quiz.passMark': '及格线 {percent}%',
  'changes.quiz.attempts.one': '可作答 {count} 次',
  'changes.quiz.attempts.other': '可作答 {count} 次',
  'changes.quiz.timeLimit': '限时 {minutes} 分钟',
  'changes.quiz.correct': '正确答案',

  'changes.decide.title': '作出决定',
  'changes.decide.description':
    '{writer} 于 {date}开始编辑。在您批准之前，学员看到的仍是原来的课程。',
  'changes.decide.approve': '批准并发布',
  'changes.decide.unresolved.one': '批准前，请先为这处冲突选择版本。',
  'changes.decide.unresolved.other': '批准前，请先为这 {count} 处冲突逐一选择版本。',
  'changes.decide.together': '这些更改会一起上线。凡是保留下来的内容，学员的学习进度都会保留。',
  'changes.decide.discard': '放弃这些更改',
  'changes.decide.notAllowed': '这些更改由所有者或管理员决定批准还是放弃。',

  'changes.discard.title': '要放弃这些更改吗？',
  'changes.discard.description':
    '{writer} 在这里所做的全部更改都将被丢弃，系统会发邮件通知对方。已上线课程不受影响。此操作无法撤销。',
  'changes.discard.confirm': '放弃',

  'changes.toast.chooseAgain': '请重新选择',
  'changes.toast.approved': '更改已上线',
  'changes.toast.approved.description': '学员现在看到的是更新后的课程。',
  'changes.toast.approveFailed': '批准失败',
  'changes.toast.discarded': '更改已放弃',
  'changes.toast.discarded.description': '课程保持不变。',
  'changes.toast.discardFailed': '放弃更改失败',

  'changes.item.clash': '见上方冲突',
  'changes.item.inLesson': '位于“{lesson}”',
  'changes.item.edited.quiz': '题目或设置有改动，对比见下方。',
  'changes.item.edited.other': '详细信息有改动。',
  'changes.decide.firstOpen': '前往第一处未处理的冲突',
} satisfies Record<keyof typeof changesEn, string>

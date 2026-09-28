# Woodworking Planner — מסמך פרויקט

> תקשורת עם המשתמש (נריה): **בעברית**. קוד, שמות משתנים ו־commits: באנגלית.

## מטרה
כלי **mobile-first** לסקיצה תלת־ממדית של עבודות עץ מחלקים קיימים (משטחים, קרשים, שידות).
דוגמה: אי מטבח משידה קיימת + משטח. מצלמים חלק → הוא הופך לתיבה תלת־ממדית במידות אמיתיות → גוררים, משנים גודל, מפרקים ומחברים.
- **ללא AI.** המרה מתמונה = גיאומטריה (homography) + הזנת מידות ידנית.
- סקיצה לתכנון, לא שרטוט הנדסי.

## סטאק
- React 18 + TypeScript + Vite
- three + @react-three/fiber + @react-three/drei
- Redux Toolkit + react-redux (typed hooks: `useAppDispatch`, `useAppSelector`)
- CSS Modules + clsx
- Vitest ללוגיקה טהורה
- בהמשך: idb-keyval (IndexedDB), vite-plugin-pwa

## קונבנציות קוד
- קומפוננטות פונקציונליות `FC<Props>`, `interface <Name>Props` מעל הקומפוננטה, פירוק props בחתימה. default export.
- CSS Modules בלבד (`Name.module.css`, class ב־camelCase). inline style רק לערכים דינמיים מחושבים.
- אסור `any`. ערכי input/select → type guard או cast ל־union ספציפי.
- מבנה:
  ```
  src/
    components/<Name>/{Name.tsx, Name.module.css, index.ts}
    features/<feature>/<feature>Slice.ts
    store/store.ts
    hooks/            (useAppDispatch/useAppSelector וכו')
    lib/              (פונקציות טהורות: geometry, snapping, collisions, homography) + tests
    types/
  ```
- `useState` למצב של קומפוננטה אחת; Redux רק למצב משותף (הסצנה, בחירה, כלי פעיל).
- handlers: props בשם `onX`, פונקציות מקומיות `handleX`.
- ממשק בעברית, `dir="rtl"`.

## יחידות
- **פנימית: מילימטרים (int).** תצוגה: ס"מ ברזולוציה 0.5.
- בסצנה: 1 יחידת three = 1 ס"מ (יחסים אמיתיים).
- עזרי קנה מידה: רשת רצפה 10 ס"מ, תוויות מידות לחלק נבחר, מידות כלליות, דמות אדם 175 ס"מ (toggle).

## מגע ועכבר (Pointer Events אחידים, `touch-action: none` על ה־canvas)
| פעולה | טלפון | מחשב |
|---|---|---|
| בחירה | הקשה | קליק |
| הזזת חלק | גרירה על החלק | גרירה על החלק |
| סיבוב מצלמה | גרירה על רקע ריק | גרירה על רקע ריק |
| זום | צביטה | גלגלת |
| pan | שתי אצבעות | קליק ימני + גרירה |
| תפריט הקשר | לחיצה ארוכה | קליק ימני |
- יעדי מגע ≥ 44px. OrbitControls מושבת בזמן גרירת חלק.
- גרירה = raycast למישור (רצפה / ציר פעיל), לא TransformControls.

## מסכים (לפי הסקיצה שאושרה)
1. **הוספת חלק מצילום**: תמונה, 4 נקודות גרירה לפינות, שדות רוחב/גובה/עומק, "צלם צד נוסף", "צור חלק".
2. **עורך תלת־ממד**: סרגל עליון (שם פרויקט, תפריט, undo/redo) · canvas · פאנל חלק נבחר (שם, מידות, שינוי מספרי/סליידר) · כפתורי "פתח/סגור מגירה", "מצב שקוף" · סרגל תחתון: הזז / סובב / גודל / פרק.

## מבנה נתונים (טיוטה)
```ts
type Mm = number;
interface Vec3Mm { x: Mm; y: Mm; z: Mm }
interface SizeMm { w: Mm; h: Mm; d: Mm }
type FaceName = 'front' | 'back' | 'left' | 'right' | 'top';

interface FaceImage { imageId: string; corners: [number, number][]; rectifiedImageId: string }
interface LibraryPart {
  id: string; name: string;
  kind: 'board' | 'panel' | 'cabinet' | 'other';
  sizeMm: SizeMm;
  faces: Partial<Record<FaceName, FaceImage>>;
  material: { type: 'texture' | 'color' | 'preset'; value: string };
  textureMode: 'stretch' | 'tile';
}
type Motion =
  | { type: 'hinge'; side: 'left' | 'right' | 'top' | 'bottom'; maxAngleDeg: number }
  | { type: 'slide'; distanceMm: Mm };
interface SceneNode {
  id: string; name: string; type: 'piece' | 'group'; parentId: string | null;
  positionMm: Vec3Mm;
  rotation: { x: 0|1|2|3; y: 0|1|2|3; z: 0|1|2|3 }; // צעדים של 90°
  sizeMm?: SizeMm;            // piece
  sourcePartId?: string;
  uvRect?: { u0: number; v0: number; u1: number; v1: number };
  material?: LibraryPart['material'];
  motion?: Motion; openAmount?: number; hidden?: boolean;
}
interface Project { id: string; name: string; nodes: SceneNode[] }
```

## שלבים
### שלב 1 — עורך תלת־ממד בסיסי
- הוספת תיבה ידנית (מידות + צבע / preset: אורן, אלון, MDF לבן, סנדוויץ').
- בחירה + מסגרת הדגשה.
- הזזה: רצפה או ציר פעיל; snapping פאה־לפאה, יישור קצוות, הנחה על גבי חלק; snap לרשת 1 ס"מ (ניתן לכבות).
- סיבוב 90° סביב Y; השכבה/העמדה (X/Z).
- שינוי גודל: ידיות על פאות (הפאה הנגדית נשארת במקום), פאנל מספרי, נעילת פרופורציות.
- שכפול, מחיקה, undo/redo.
- מבטים: חופשי / חזית / צד / למעלה. תוויות מידות, מידות כלליות, דמות אדם.
- התנגשות (AABB) → החלק נצבע אדום.
- ללא שמירה, אבל כל הסצנה ב־Redux וסריאליזבילית.

### שלב 2 — צילום → חלק
- 4 פינות → homography עצמאית ב־`src/lib` (canvas + inverse mapping, בלי OpenCV) → תמונה מיושרת.
- יחס רוחב/גובה מהתמונה; מידה אמיתית אחת → השאר מחושב. אופציה: A4 (21×29.7) כייחוס.
- טקסטורה לפאה; פאות בלי תמונה = צבע ממוצע שנדגם. `textureMode` stretch/tile.

### שלב 3 — צילום מכמה כיוונים
- חובה חזית; אופציונלי צד/עליון/גב. הצלבת יחסים (חזית W/H, צד D/H, עליון W/D) + אזהרה על סתירה. דריסה ידנית תמיד.

### שלב 4 — פירוק וקבוצות
- group של pieces; הזזת קבוצה כיחידה; פירוק/קיבוץ.
- חיתוך בציר+מיקום (שמירת uvRect) · פירוק לדפנות בעובי נבחר · קווי חלוקה על תמונת החזית.

### שלב 5 — דלתות ומגירות
- hinge/slide, פתיחה בהקשה עם אנימציה, פתח/סגור הכול, סליידר פתיחה חלקית.
- מצב שקוף (X-ray), הסתרה זמנית, התנגשות במסלול פתיחה.

### שלב 6 — שמירה והתקנה
- IndexedDB (idb-keyval) למלאי ולפרויקטים; ייצוא/ייבוא JSON; PWA.

### שלב 7 — שדרוגים
- רשימת חלקים/חיתוכים, מלאי שנותר, צילום מסך, Express + MongoDB, AR (WebXR).

## כללי עבודה
- לוגיקה גיאומטרית = פונקציות טהורות ב־`src/lib` עם בדיקות Vitest.
- בסוף כל שלב: `npm run typecheck && npm run test && npm run build` נקיים.
- לבדוק בטלפון: `npm run dev -- --host`.
- החלטה גדולה שלא מופיעה כאן → לשאול את נריה.

## החלטות מימוש (שלב 1)
- כל חלק מיושר לצירים (סיבובים של 90° בלבד) → `positionMm` = הפינה המינימלית של ה־AABB, והגודל האפקטיבי מחושב מ־`rotation` (`lib/geometry.ts`).
- גרירה: `hooks/useCanvasDrag.ts` — מאזינים ברמת window, סף 6px בין הקשה לגרירה, OrbitControls מושבת במהלך הגרירה, אצבע שנייה מבטלת את הגרירה.
- הזזה: הצמדה פאה־לפאה / יישור קצוות (סף 4 ס"מ) ← אחרת רשת 1 ס"מ. גובה: אם החלק "נכנס" במשהו הוא קופץ עליו, אחרת נוחת על המשטח הגבוה ביותר שמתחתיו או על הרצפה (`lib/snapping.ts`).
- undo/redo: `checkpoint` בתחילת מחווה + עדכונים transient, ו־`discardCheckpointIfUnchanged` בסוף → כל גרירה = צעד undo אחד.
- קומפוננטות תלת־ממד (`PieceMesh`, `ResizeHandles`, `HumanFigure`) בלי CSS Module — אין להן DOM.
- טקסטורות לפי סדר פאות BoxGeometry: +x ימין, -x שמאל, +y עליון, -y תחתון, +z חזית, -z גב. ה־UV של three מתאים לצילום "מבחוץ" של כל פאה (עליון מצולם מלפנים).
- קיצורי מקלדת (מחשב): Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Delete, Ctrl+D שכפול, R סיבוב, Esc ביטול בחירה, M הזזה, S גודל.

## סטטוס נוכחי
- [x] תכנון ו־CLAUDE.md
- [x] שלב 1 — עורך תלת־ממד בסיסי (branch `feat/stage-1-editor`)
  - הוספת חלק (תבניות: קרש/משטח/שידה/מדף), בחירה, הזזה עם הצמדה והערמה, סיבוב (Y + השכבה X/Z), ידיות שינוי גודל, פאנל מספרי, נעילת פרופורציות, גובה מהרצפה, שכפול/מחיקה, undo/redo, מבטים, מידות, דמות אדם, התנגשויות.
  - ידוע: אין עדיין שמירה (שלב 6); צבע מותאם הוא צבע אחיד; bundle ~1.1MB (אפשר code-split בהמשך).
- [x] שלבים 2+3 — צילום → חלק, כולל כמה כיוונים (branch `feat/stage-2-photo`)
  - מצלמה/גלריה → סימון 4 פינות עם זכוכית מגדלת → יישור (homography) → טקסטורה לפאה.
  - יחס אמיתי מתמונה אחת (שיטת Zhang & He, משחזרת אורך מוקד; נקודה ראשית = מרכז התמונה).
  - דף A4 על הפאה → מידות אמיתיות. צילומים נוספים (צדדים/עליון/גב) → השלמת מידות + אזהרת סתירה (>10%).
  - תמונות נשמרות מחוץ ל־Redux ב־`features/images/imageRegistry.ts` (Redux שומר רק id).
  - צד אחד מצולם משמש לשני הצדדים; פאות בלי תמונה = הצבע הממוצע.

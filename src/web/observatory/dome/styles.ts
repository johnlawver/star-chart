// The Dome's look (design A, chosen by the family 2026-10-24; see .scratch/observatory-design/verdict.md). Every size is
// on the 800×1280 stage. Written for the frame: no :has(), no nesting, no 4/8-digit hex, and nothing animates forever.
export const domeCss = `
.dome-screen { position: absolute; left: 0; top: 0; width: 800px; height: 1280px; overflow: hidden; }
.dome-big { position: absolute; left: 30px; right: 30px; text-align: center; font-size: 60px; font-weight: 700; text-shadow: 0 5px 0 rgba(0,0,0,0.6); }
.dome-medium { font-size: 38px; font-weight: 600; }

.dome-dome { position: absolute; left: 40px; right: 40px; top: 30px; height: 560px; border-radius: 360px 360px 40px 40px;
  background: radial-gradient(circle at 50% 30%, #2a3a8c 0%, #11164a 70%); border: 10px solid #8b6bd9; overflow: hidden; }
.dome-title { position: absolute; top: 46px; left: 0; right: 0; text-align: center; font-size: 46px; font-weight: 700; text-shadow: 0 4px 0 #000; }
.dome-jar { position: absolute; left: 80px; bottom: 76px; padding: 0; border: none; background: none; color: #fff; font: inherit; }
.dome-count { position: absolute; left: 0; right: 0; bottom: -58px; text-align: center; font-size: 40px; font-weight: 700; }
.dome-mascot { position: absolute; right: 60px; bottom: 30px; }

.dome-planets { position: absolute; top: 620px; left: 20px; right: 20px; height: 470px; overflow-x: hidden; overflow-y: auto;
  display: flex; flex-wrap: wrap; align-content: flex-start; justify-content: center; }
.dome-planet { width: 220px; height: 220px; margin: 8px; padding: 10px; border-radius: 50%; border: none; color: #fff; font: inherit;
  font-size: 28px; font-weight: 700; line-height: 1.1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  box-shadow: inset -20px -20px 0 rgba(0,0,0,0.18), 0 10px 0 rgba(0,0,0,0.3); }
.dome-planet:active { transform: scale(0.94); }
.dome-icon img { filter: invert(1); }
.dome-planet small { font-size: 24px; margin-top: 6px; }
.dome-planet[disabled] { opacity: 0.4; }

.dome-dock { position: absolute; left: 0; right: 0; bottom: 0; height: 170px; display: flex; justify-content: space-around; align-items: center;
  background: rgba(0,0,0,0.35); border-top: 6px solid #8b6bd9; }
.dome-door { width: 150px; height: 130px; border-radius: 30px; border: none; background: #8b6bd9; color: #fff; font: inherit; font-size: 24px;
  font-weight: 700; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 8px 0 #5a3fa8; }
.dome-door:active { transform: translateY(6px); box-shadow: 0 2px 0 #5a3fa8; }
.dome-door-arrow { font-size: 54px; line-height: 1; }

.dome-who { top: 230px; height: 900px; }
.dome-who .dome-planet { width: 330px; height: 330px; }
.dome-who .dome-planet span { font-size: 40px; margin-top: 4px; }
.dome-corner { position: absolute; right: 18px; bottom: 18px; padding: 10px 16px; border-radius: 16px; border: 2px solid rgba(255,255,255,0.35);
  background: rgba(0,0,0,0.25); color: rgba(255,255,255,0.75); font: inherit; font-size: 20px; }

.dome-panel { position: absolute; left: 40px; right: 40px; top: 120px; bottom: 210px; border-radius: 40px; background: rgba(255,255,255,0.1);
  padding: 30px; overflow-x: hidden; overflow-y: auto; }
.dome-sky { top: 40px; bottom: 200px; background: #080b26; border: 6px solid #8b6bd9; display: flex; flex-wrap: wrap; justify-content: center; align-content: flex-start; }
.dome-sky-round { width: 100%; text-align: center; color: #ffcf4d; margin-bottom: 8px; }
.dome-sky-tile { width: 200px; margin: 4px; text-align: center; }
.dome-sky-label { font-size: 20px; line-height: 1.25; min-height: 50px; }
.dome-shop { align-content: flex-start; }
.dome-shelf-item { width: 200px; height: 215px; margin: 8px; padding: 12px; border-radius: 28px; border: none; background: #fff; color: #2b2140; font: inherit;
  font-size: 22px; font-weight: 700; display: flex; flex-direction: column; align-items: center; justify-content: space-between; box-shadow: 0 8px 0 #c4b6ef; }
.dome-shelf-item:active { transform: translateY(6px); box-shadow: 0 2px 0 #c4b6ef; }
.dome-shelf-item[disabled] { opacity: 0.45; }
.dome-shelf-item.dome-owned { opacity: 1; background: #e6f7e2; box-shadow: 0 8px 0 #9bd18f; }
.dome-shelf-item.dome-worn { background: #fff3c4; box-shadow: 0 8px 0 #e6c24d; }
.dome-shelf-name { font-size: 20px; line-height: 1.1; }
.dome-price { display: flex; align-items: center; font-size: 30px; }
.dome-price img { margin-left: 4px; }
.dome-book { top: 40px; bottom: 200px; background: #f6e7c8; border: 6px solid #d9b77a; display: flex; flex-wrap: wrap; justify-content: center; align-content: flex-start; }
.dome-book-sticker { display: inline-block; margin: 16px; }
.dome-book-empty { width: 100%; margin-top: 200px; display: flex; flex-direction: column; align-items: center; color: #7c4f2a; }
.dome-book-empty .dome-door { margin-top: 30px; }
.dome-ticket { position: absolute; left: 230px; top: 260px; width: 340px; min-height: 480px; box-sizing: border-box; background: #fff; color: #000;
  border-radius: 6px; padding: 24px; text-align: center; font-size: 32px; }
.dome-ticket-art { margin: 30px 0; }
.dome-choice { position: absolute; left: 0; right: 0; top: 900px; display: flex; justify-content: center; }
.dome-choice .dome-door { width: 260px; margin: 0 16px; }

.dome-overlay { position: absolute; left: 0; top: 0; right: 0; bottom: 0; z-index: 50; background: rgba(8,10,40,0.82); border: none;
  padding: 0; color: #fff; font: inherit; }
.dome-overlay-mascot { position: absolute; left: 290px; top: 260px; }

.dome-banner { position: absolute; left: 120px; right: 120px; top: 8px; z-index: 40; padding: 12px 18px; border-radius: 20px;
  background: #ffd84d; color: #2b2140; text-align: center; font-size: 26px; font-weight: 700; }

/* Out of date while the server can't be reached: small and quiet, for grown-ups to notice, not children. */
.dome-offline { position: absolute; left: 16px; top: 2px; z-index: 45; margin: 0; padding: 2px 12px; border-radius: 12px;
  background: rgba(0,0,0,0.4); color: rgba(255,255,255,0.7); font-size: 18px; }

.plain { position: relative; padding: 48px; font-size: 28px; }
.plain h1 { font-size: 48px; margin: 0 0 24px; }
.plain label { display: block; margin: 0 0 18px; }
.plain input { display: block; width: 100%; box-sizing: border-box; font: inherit; padding: 12px; border-radius: 12px; border: none; margin-top: 6px; }
.setup-from-phone { text-align: center; }
.setup-qr { display: block; margin: 24px auto; background: #fff; border-radius: 12px; }
.setup-code { font-size: 64px; font-weight: bold; letter-spacing: 8px; margin: 8px 0 32px; }
.plain button { font: inherit; min-height: 64px; padding: 0 24px; margin: 8px 12px 8px 0; border-radius: 18px; border: none; background: #8b6bd9; color: #fff; }
.plain-keys { display: flex; flex-wrap: wrap; width: 560px; }
.plain-keys button { width: 160px; height: 110px; font-size: 44px; }
.plain-pin { font-size: 64px; letter-spacing: 12px; min-height: 80px; }
`;

/** Planet colours, used in turn. */
export const categoryColours = ["#ff7a59", "#3fb4a7", "#d65db1"];
export const taskColours = ["#4a7bd8", "#e0a020", "#56b34f"];

export const SHOWCASE_MOCKUP = {
  frameSrc: '/mockups/iphone-16-pro-black-titanium.png',
  maskSrc: '/mockups/iphone-16-pro-black-titanium-mask.png',
  frame: { width: 1406, height: 2822 },
  screen: { x: 102, y: 100, width: 1206, height: 2622, radius: 118 },
} as const;

export const screenStyle = {
  left: `${(SHOWCASE_MOCKUP.screen.x / SHOWCASE_MOCKUP.frame.width) * 100}%`,
  top: `${(SHOWCASE_MOCKUP.screen.y / SHOWCASE_MOCKUP.frame.height) * 100}%`,
  width: `${(SHOWCASE_MOCKUP.screen.width / SHOWCASE_MOCKUP.frame.width) * 100}%`,
  height: `${(SHOWCASE_MOCKUP.screen.height / SHOWCASE_MOCKUP.frame.height) * 100}%`,
  borderRadius: `${(SHOWCASE_MOCKUP.screen.radius / SHOWCASE_MOCKUP.screen.width) * 100}% / ${(SHOWCASE_MOCKUP.screen.radius / SHOWCASE_MOCKUP.screen.height) * 100}%`,
} as const;

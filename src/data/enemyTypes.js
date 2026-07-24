// Enemy archetypes. `armor` is fractional damage reduction against NON-magic
// hits (archer/artillery/soldiers); Magic ignores it. `flying` creeps can't be
// blocked or hit by Barracks soldiers. hp/speed are further scaled per wave.
export const ENEMY_TYPES = {
  grunt:   { name: "Grunt",   radius: 12, hp: 45,  speed: 55,  reward: 12, armor: 0,    flying: false,
             colors: { light: "#f08a7d", mid: "#c0392b", dark: "#7d1d13" } },
  runner:  { name: "Runner",  radius: 9,  hp: 26,  speed: 108, reward: 10, armor: 0,    flying: false,
             colors: { light: "#ffe9a0", mid: "#e6b422", dark: "#9a7410" } },
  armored: { name: "Armored", radius: 12, hp: 70,  speed: 48,  reward: 18, armor: 0.55, flying: false,
             colors: { light: "#cdd6e2", mid: "#8b97a8", dark: "#4f5a6b" } },
  tank:    { name: "Tank",    radius: 18, hp: 190, speed: 34,  reward: 28, armor: 0.2,  flying: false,
             colors: { light: "#b98a6a", mid: "#7c4f30", dark: "#472a17" } },
  flyer:   { name: "Flyer",   radius: 11, hp: 52,  speed: 74,  reward: 16, armor: 0,    flying: true,
             colors: { light: "#c9b6ff", mid: "#7d5fd6", dark: "#452f8c" } },
  boss:    { name: "Boss",    radius: 26, hp: 1100, speed: 26, reward: 160, armor: 0.35, flying: false, boss: true,
             colors: { light: "#ff9d76", mid: "#b5361e", dark: "#5e160c" } },
};

<template>
  <div class="pillbox">
    <div class="pill-a" @click="playSound"><router-link to="/decks/deck01">Deck 01</router-link></div>
    <div class="pill-a" @click="playSound"><router-link to="/decks/deck02">Deck 02</router-link></div>
    <div class="pill-a" @click="playSound"><router-link to="/decks/deck03">Deck 03</router-link></div>
    <div class="pill-a" @click="playSound"><router-link to="/decks/deck04">Deck 04</router-link></div>
    <div class="pill-a" @click="playSound"><router-link to="/decks/deck05">Deck 05</router-link></div>
    <div class="pill-a" @click="playSound"><router-link to="/decks/deck06">Deck 06</router-link></div>
    <div class="pill-a" @click="playSound"><router-link to="/decks/deck07">Deck 07</router-link></div>
    <div class="pill-a" @click="playSound"><router-link to="/decks/deck08">Deck 08</router-link></div>
  </div>
</template>

<script>
import soundFile from '../../assets/sounds/panel_beep_03.mp3';

export default {
  name: 'PillboxDecks',
  methods: {
    playSound() {
      const audio = new Audio(soundFile);
      audio.play();
    }
  }
};
</script>

<style scoped>
@import '../../assets/styles/classic.css';
</style>

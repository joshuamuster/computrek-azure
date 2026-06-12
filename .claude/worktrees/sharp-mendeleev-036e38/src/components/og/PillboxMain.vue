<template>
  <div class="pillbox">
    <div class="pill" @click="playSound"><router-link to="/crew">Crew</router-link></div>
    <div class="pill" @click="playSound"><router-link to="/courses/CompSci">Courses</router-link></div>
    <div class="pill" @click="playSound"><router-link to="/decks">Decks</router-link></div>
    <div class="pill" @click="playSound"><router-link :to="getLessonsLink()">Lessons</router-link></div>
    <div class="pill" @click="playSound"><router-link to="/systems">Systems</router-link></div>
    <div class="pill" @click="playSound"><router-link to="/grades">Grades</router-link></div>
  </div>
</template>

<script>
import { useRoute } from 'vue-router';
import soundFile from '../../assets/sounds/panel_beep_14.mp3';

export default {
  name: 'PillboxMain',
  setup() {
    const route = useRoute();

    const getLessonsLink = () => {
      const path = route.path;

      // If we're already on a unit page like /courses/unit01, stay there
      if (path.match(/^\/courses\/unit\d+$/)) {
        return path;
      }

      // If we're in a lesson page like /courses/unit01/Lesson01
      if (path.match(/\/courses\/unit\d+\/Lesson\d+/)) {
        // Extract the unit part (e.g., /courses/unit01)
        const unitPath = path.match(/\/courses\/unit\d+/)[0];
        return unitPath;
      }

      // Default to main courses page
      return '/courses';
    };

    return {
      getLessonsLink
    };
  },
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

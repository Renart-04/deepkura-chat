<script setup lang="ts">
import { RouterView } from 'vue-router'
import LoadingBar from './components/LoadingBar.vue'
import { useTheme } from './composables/useTheme'
import { useChat } from './composables/useChat'

useTheme() // Init theme
useChat() // Init chat listeners globally
</script>

<template>
  <LoadingBar />
  <RouterView />
</template>

<style>
@import './style.css';
</style>

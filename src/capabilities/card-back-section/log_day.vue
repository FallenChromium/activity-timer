<template>
    <div class="day-summary">{{dateString}} - {{dayTotalDisplay}}</div>
    <EntryCard v-for="range in props.ranges.sort((a,b) => a.start > b.start ? -1 : 1)" :range="range" :members="boardMembers" :card="props.card"></EntryCard>
</template>

<script setup lang="ts">
import { Range } from '../../components/range';
import EntryCard from './entry_card.vue'
import { computed, PropType } from 'vue'
import { formatTime } from '../../utils/formatting';
import { Trello } from '../../types/trello';
import { Card } from '../../components/card';
const props = defineProps({
  ranges: {
    type: Array as PropType<Array<Range>>,
    required: true
  },
  dateString: {
    type: String,
    required: true
  },
  boardMembers: {
    type: Array as PropType<Array<Trello.PowerUp.Member>>,
    required: true
  },
  card: {
    type: Card,
    required: true
  }
});
const dayTotal = computed(() => props.ranges.reduce((total, range) => total + range.diff, 0))
const dayTotalDisplay = computed(() => formatTime(dayTotal.value))
</script>

<style>
.day-summary {
    display: flex;
    font-weight: 600;
    font-size: 12px;
    color: rgb(107, 119, 140);
}
</style>

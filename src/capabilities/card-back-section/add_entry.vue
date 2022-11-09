<template>
<h3 style="margin: 10px">Add worklog</h3>
<div class="frame">
  <label>Time started:</label>
  <date-picker v-model="startingPoint" :config="flatpickrConfig" />
  <label>Time spent:</label>
  <input v-model="loggedTime" placeholder="e.g. 4h 5m, 6h, 4.5h" :class="{ 'is-error': parseError}" autofocus />
  <label>Status:</label>
  <div>You've worked on this card for <b>{{totalLog}}</b>.</div>
  <div v-if="ownEstimate"> Your estimate for this task is <b>{{ownEstimateDisplay}}</b>.</div>
  <div v-if="totalEstimate && totalEstimate > 0"> Total estimate for this card is <b>{{totalEstimateDisplay}}</b>.</div>
  <label>Comment:</label>
  <textarea class="comments" rows="5" cols="1" wrap="soft" v-model="entryComment" maxlength="120"></textarea>
  <UIButton @click="save">Save estimate</UIButton>
</div>
</template>

<script setup lang="ts">
import { formatTime } from '../../utils/formatting';
import { ref, computed } from 'vue';
import { Card } from '../../components/card';
import { Range } from '../../components/range';
import { minutesToTime, timeToMinutes } from '../../utils/convert-time'
import UIButton from '../../components/UIButton.vue';
import DatePicker from 'vue-flatpickr-component';
import 'flatpickr/dist/flatpickr.css';

import {
  getMemberId,
  getTrelloCard,
  resizeTrelloFrame
} from '../../components/trello';

const flatpickrConfig = {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true
      };

const trelloInstance = getTrelloCard()
const loggedItems = ref<Range[]|null>(null);
const totalEstimate = ref<number>(0);
const entryComment = ref<string>("")
const ownEstimate = ref<number>(0);
const parseError = computed(() => loggedMinutes.value === 0)
const totalEstimateDisplay = computed(() => {
  return formatTime(totalEstimate.value);
});

const ownEstimateDisplay = computed(() => {
  return formatTime(ownEstimate.value);
});
const startingPoint = ref<import("flatpickr/dist/types/options").DateOption>(new Date());
const loggedTime = ref<string>('');
const startTime = computed(() => Math.floor(new Date(startingPoint.value).getTime() / 1000));
const loggedMinutes = computed(() => {
  try {
    return timeToMinutes(loggedTime.value, 5, 8)
  }
  catch (e) {
    return 0
  }
});
const totalLog = computed(() => 
  formatTime(
    loggedItems.value ? 
      Math.floor(loggedItems.value.reduce((a, b) => a + b.diff, 0) + loggedMinutes.value * 60) : 
      loggedMinutes.value
  )
)
const endTime = computed(() => loggedMinutes ? startTime.value + loggedMinutes.value * 60 : startTime.value)



const save = async () => {
  const memberId = await getMemberId();
  const card = await trelloInstance.card('id');
  const cardModel = new Card(card.id);
  const ranges = await cardModel.getRanges();
  if (loggedTime.value) {
    console.log(startTime.value, loggedMinutes.value, endTime.value)
    ranges.add(new Range(memberId, startTime.value, endTime.value, entryComment.value));
  }

  await ranges.save().then(() => trelloInstance.closeModal()).catch(() => trelloInstance.alert({message: "Couldn't save the new entry, please re-check your data.", duration: 5}));
  
};

const fetchCardData = async () => {
  const memberId = await getMemberId();
  const card = await trelloInstance.card('id');
  const cardModel = new Card(card.id);
  const ranges = await cardModel.getRanges();

  loggedItems.value = ranges.items.filter((obj) => obj.memberId == memberId)

  const estimates = await cardModel.getEstimates();
  const yourEstimate = estimates.getByMemberId(memberId)
  ownEstimate.value = yourEstimate ? yourEstimate.time : 0;
  totalEstimate.value = estimates.totalEstimate;
};

fetchCardData()

//setTimeout(resizeTrelloFrame);
</script>

<style>
.frame {
  margin: 15px 20px
}

.comments {
  max-width: 500px;
}
</style>

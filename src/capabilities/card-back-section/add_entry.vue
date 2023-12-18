<template>
<h3 style="margin: 10px">Add worklog</h3>
<div class="frame">
  <label class="block">Time finished:</label>
  <date-picker class="block mb-3 picker" v-model="pickedTime" :config="flatpickrConfig" />
  <label class="block">Time spent:</label>
  <InputText class="block mb-3" v-model="loggedTime" placeholder="e.g. 4h 5m, 6h, 4.5h" :class="{ 'p-invalid': parseError}" autofocus />
  <label class="block">Status:</label>
  <div class="block  mb-3">You've worked on this card for <b>{{totalLog}}</b>, you're tracking a period from <b>{{ formatDateTime(startPoint) }}</b> to <b>{{ formatDateTime(endPoint) }}</b>.</div>
  <div v-if="ownEstimate" class="block"> Your estimate for this task is <b>{{ownEstimateDisplay}}</b>.</div>
  <div v-if="totalEstimate && totalEstimate > 0" class="block  mb-3"> Total estimate for this card is <b>{{totalEstimateDisplay}}</b>.</div>
  <label class="block">Comment:</label>
  <Textarea class="comments block  mb-7" rows="5" cols="30" wrap="soft" v-model="entryComment" maxlength="120"></TextArea>
  <Button class="block mb-3" @click="save" label="Save entry" />
</div>
</template>

<script setup lang="ts">
import { formatTime, formatDateTime } from '../../utils/formatting';
import { ref, computed, ComputedRef } from 'vue';
import { Card } from '../../components/card';
import { Range } from '../../components/range';
import  Textarea from 'primevue/textarea'
import InputText from 'primevue/inputtext'
import { timeToMinutes } from '../../utils/convert-time'
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
const pickedTime = ref<import("flatpickr/dist/types/options").DateOption>(new Date())
const endPoint = computed<Date>(() => new Date(pickedTime.value));
const endSeconds = computed<number>(() => endPoint.value.getTime() / 1000);
const loggedTime = ref<string>('');
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
const startSeconds: ComputedRef<number> = computed(() => loggedMinutes ? endSeconds.value - loggedMinutes.value * 60 : endSeconds.value)
const startPoint: ComputedRef<Date> = computed(() => new Date(startSeconds.value * 1000))



const save = async () => {
  const memberId = await getMemberId();
  const card = await trelloInstance.card('id');
  const cardModel = new Card(card.id);
  const ranges = await cardModel.getRanges();
  if (loggedTime.value) {
    console.log(startSeconds.value, loggedMinutes.value, endSeconds.value)
    ranges.add(new Range(memberId, startSeconds.value, endSeconds.value, entryComment.value));
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
  margin: 15px 20px;
}

.comments {
  max-width: 500px;
}

.picker {
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 1rem;
  border: 1px solid #ced4da;
  padding: 0.5rem 0.75rem;
}
</style>

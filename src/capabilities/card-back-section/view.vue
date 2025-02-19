<template>
  <UIRow v-if="canWrite && visible">
    <div>
      <UIButton v-if="!isTracking" @click="startTracking">Start timer</UIButton>
      <UIButton v-else @click="stopTracking" :danger="true">
        Stop timer
      </UIButton>
      <UIButton @click="addEntry">Add entry</UIButton>
      <UIInfo icon="clock">{{ timeSpentDisplay }}</UIInfo>
    </div>

    <div v-if="hasEstimates">
      <UIInfo style="cursor: pointer" @click="changeEstimate"
        >Estimate: {{ ownEstimateDisplay }}</UIInfo
      >
      <UIInfo
        style="cursor: pointer"
        v-if="ownEstimate != totalEstimate"
        @click="viewEstimates"
        >Total estimate: {{ totalEstimateDisplay }}</UIInfo
      >
    </div>
  </UIRow>

  <UIRow v-else-if="hasEstimates && totalEstimate && visible">
    <div>
      <UIInfo v-if="ownEstimate != totalEstimate"
        >Total estimate: {{ totalEstimateDisplay }}</UIInfo
      >
    </div>
  </UIRow>

  <p v-else>No options available.</p>
    <LogDay :ranges="range" :dateString="date" :boardMembers="members" v-if="trackingLogByDay" v-for="[date, range]  in trackingLogByDayIterator(trackingLogByDay)"></LogDay>

</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import UIInfo from '../../components/UIInfo/UIInfo.vue';
import UIRow from '../../components/UIRow.vue';
import UIButton from '../../components/UIButton.vue';
import {
  getMemberId,
  getTrelloCard,
  getTrelloInstance,
  resizeTrelloFrame
} from '../../components/trello';
import { Card } from '../../components/card';
import { formatDate, formatTime } from '../../utils/formatting';
import { hasEstimateFeature } from '../../components/settings';
import { Trello } from '../../types/trello';
import { isVisible } from '../../utils/visibility';
import { Range } from '../../components/range';
import LogDay from './log_day.vue';

const isTracking = ref(false);
const trackedTime = ref(0);
const totalEstimate = ref(0);
const ownEstimate = ref(0);
const hasEstimates = ref(false);
const canWrite = ref(false);
const visible = ref(false);
const trackingLog = ref<Range[] | null>(null)
const trackingLogByDay = computed(() => 
    trackingLog.value ? trackingLog.value.reduce((organized: { [index: string]: Range[] }, item) => {
      const category = formatDate(new Date(item.start * 1000))
      if (!organized[category]) organized[category] = [];
      organized[category].push(item as Range);
      return organized;
    }, {}) : null
);
// used for descending sorting for the dates
const trackingLogByDayIterator = (logByDay: { [index: string]: Range[]}) => ({
  *[Symbol.iterator]() {
    yield* Object.entries(logByDay).sort((a, b) => b[0] < a[0] ? -1 : 1);
  }
})
const members = ref<Trello.PowerUp.Member[]>([]);
let cardId: string | null = null;

const timeSpentDisplay = computed(() => {
  return formatTime(trackedTime.value);
});

const totalEstimateDisplay = computed(() => {
  return formatTime(totalEstimate.value);
});

const ownEstimateDisplay = computed(() => {
  return formatTime(ownEstimate.value);
});

const trelloTick = async () => {
  if (!cardId) {
    cardId = (await getTrelloCard().card('id')).id;
  }

  canWrite.value = await getTrelloCard().memberCanWriteToModel('card');
  visible.value = await isVisible();
  hasEstimates.value = await hasEstimateFeature();

  const memberId = await getMemberId();
  const card = getCardModel();

  members.value = (await getTrelloCard().board('members')).members

  isTracking.value = await card.isRunning();
  trackedTime.value = await card.getTimeSpent();

  const estimates = await card.getEstimates();
  totalEstimate.value = estimates.totalEstimate;

  const cardRanges = await card.getRanges()
  trackingLog.value = cardRanges.items
  console.log(trackingLog.value)
  const ownEstimateItem = estimates.getByMemberId(memberId);

  if (ownEstimateItem) {
    ownEstimate.value = ownEstimateItem.time;
  } else {
    ownEstimate.value = 0;
  }
};

const getCardModel = () => {
  if (!cardId) {
    throw new Error('Unable to locate cardId');
  }

  return new Card(cardId);
};

const startTracking = async () => {
  const card = await getTrelloCard().card('id', 'idList');
  const cardModel = new Card(card.id);
  await cardModel.startTracking(card.idList);
};

const addEntry = async () => {
  const trelloInstance = getTrelloCard();
  trelloInstance.modal({
    title: "Add log entry manually",
    url: './index.html?page=add-entry',
    height: 500,
  })
}

const stopTracking = async () => {
  const cardModel = getCardModel();
  await cardModel.stopTracking(getTrelloCard());
};

const changeEstimate = async (e: MouseEvent) => {
  const trelloInstance = getTrelloCard();

  await trelloInstance.popup({
    title: 'Change estimate',
    url: './index.html?page=change-estimate',
    height: 120,
    mouseEvent: e
  });
};

const viewEstimates = async (e: MouseEvent) => {
  const trelloInstance = getTrelloCard();
  const board = await trelloInstance.board('members');
  const members = board.members
  trelloInstance.popup({
    mouseEvent: e,
    title: 'Estimates',
    items: async function (t) {
      const cardModel = getCardModel();
      const items: Trello.PowerUp.PopupOptionsItem[] = [];
      const estimates = await cardModel.getEstimates();

      const membersFound = board.members.map((member) => member.id);

      board.members
        .sort((a, b) => {
          const nameA = (a.fullName ?? '').toUpperCase();
          const nameB = (b.fullName ?? '').toUpperCase();

          if (nameA < nameB) {
            return -1;
          }
          if (nameA > nameB) {
            return 1;
          }

          return 0;
        })
        .forEach((member) => {
          const memberEstimates = estimates.items.filter((estimate) => {
            return estimate.memberId === member.id;
          });

          let memberEstimate = 0;

          memberEstimates.forEach((estimate) => {
            memberEstimate += estimate.time;
          });

          if (memberEstimate > 0) {
            items.push({
              text:
                member.fullName +
                (member.fullName !== member.username
                  ? ' (' + member.username + ')'
                  : '') +
                ': ' +
                formatTime(memberEstimate),
              callback: async (t: Trello.PowerUp.IFrame) => {
                return t.popup({
                  type: 'confirm',
                  title: 'Delete estimate?',
                  message: 'Are you sure you wish to delete this estimate?',
                  confirmText: 'Yes, delete',
                  onConfirm: async (t) => {
                    estimates.removeByMemberId(member.id);
                    await estimates.save();
                    return t.closePopup();
                  },
                  confirmStyle: 'danger',
                  cancelText: 'No, cancel'
                });
              }
            });
          }
        });

      estimates.items.forEach((estimate, estimateIndex) => {
        if (!membersFound.includes(estimate.memberId)) {
          items.push({
            text: 'N/A: ' + formatTime(estimate.time),
            callback: async (t) => {
              return t.popup({
                type: 'confirm',
                title: 'Delete estimate?',
                message: 'Are you sure you wish to delete this estimate?',
                confirmText: 'Yes, delete',
                onConfirm: async (t) => {
                  estimates.removeByMemberId(estimate.memberId);
                  await estimates.save();
                  return t.closePopup();
                },
                confirmStyle: 'danger',
                cancelText: 'No, cancel'
              });
            }
          });
        }
      });

      items.push({
        text: 'Clear estimates',
        callback: async (t: Trello.PowerUp.IFrame) => {
          return t.popup({
            type: 'confirm',
            title: 'Are you sure?',
            message: '',
            confirmText: 'Yes, clear estimates',
            onConfirm: async (t) => {
              estimates.clear();
              await estimates.save();
              return t.closePopup();
            },
            confirmStyle: 'danger',
            cancelText: 'No, cancel'
          });
        }
      });

      return items;
    }
  });
};

getTrelloCard().render(trelloTick);
trelloTick();

// Force clock to update once a minute
setInterval(trelloTick, 1000 * 60);
</script>

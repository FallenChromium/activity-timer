<template>
  <transition name="fade">
    <UILoader v-if="loading" />
  </transition>

  <UIOptroStatus v-if="ready" style="border-radius: 0" />

  <div class="unauthorized" v-if="isIncognito">
    <p>
      It appears that you might be using incognito mode in your browser.
      Unfortunately some internal functionality does not work in Trello that is
      required for this page to work. If you wan't to use the data exporter tool
      you will have to jump out of incognito.
    </p>
  </div>

  <div class="unauthorized" v-else-if="unrecognizedError">
    <p>
      Woops. An unrecognized error occurred. Our system have automatically
      logged it & will be looking into the matter. Please try again later or
      with a different browser.
    </p>
  </div>

  <div class="unauthorized" v-else-if="!isAuthorized">
    <p>
      To access tracking data you need to allow Activity timer to read this
      data. Click the button below to allow this.
    </p>
    <UIButton @click="authorize()">Authorize</UIButton>

    <p v-if="rejectedAuth">
      You rejected Activity timer's request for accessing the data. If you
      change your mind you can always click 'Authorize' again.
    </p>
  </div>

  <div class="authorized" v-else-if="ready && isAuthorized">
    <div class="header" v-if="hasSubscription">
      <div class="header__filters">
        <UIDropdown
          v-model="members"
          label="Members"
          placeholder="No filtering"
          :multiple="true"
          :options="memberOptions"
        />

        <UIDropdown
          v-model="boards"
          label="Boards"
          placeholder="None"
          :multiple="true"
          :options="boardOptions"
          @update:modelValue="getData()"
        />

        <UIDropdown
          v-model="lists"
          label="Lists"
          placeholder="No filtering"
          :multiple="true"
          :options="listOptions"
        />

        <UIDropdown
          v-model="labels"
          label="Labels"
          placeholder="No filtering"
          :multiple="true"
          :options="labelOptions"
        />

        <UIDropdown
          v-model="columns"
          label="Columns"
          placeholder="Default"
          :multiple="true"
          :options="columnOptions"
        />

        <UIDateInput v-model="dateFrom" label="Date from" />

        <UIDateInput v-model="dateTo" label="Date to" />
      </div>

      <UIDropdown
        v-model="groupEntities"
        label="Group by"
        help="No grouping = each time tracking is on a separate row"
        placeholder="No grouping"
        :multiple="true"
        :options="groupByOptions"
      />
    </div>

    <div class="requires-pro" v-else>
      <p>
        Filtering in data export is restricted to Pro users only. Free plan can
        only do full exports.
        <a
          :href="`https://www.optro.cloud/app/${powerupId}`"
          target="_blank"
          rel="noreferrer"
          >Read more about the Pro plan here.</a
        >
      </p>
    </div>

    <table class="body" v-if="tableBody.length > 0">
      <thead>
        <tr>
          <th v-for="headItem in tableHead" :key="headItem.value">
            {{ headItem.text }}
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="tableRow in tableBody" :key="tableRow.id">
          <td
            v-for="columnItem in tableHead"
            :key="columnItem.value"
            :style="columnStyle[columnItem.value] ?? {}"
          >
            {{ tableRow[columnItem.value] ?? '' }}
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else>No cards found with trackings matching your filter</p>

    <div class="footer">
      <div>
        <UIButton @click="exportData()">Export to CSV</UIButton>
        <UIButton @click="getData()">Refresh</UIButton>
      </div>

      <div class="footer__info">
        <span>Total time (seconds): {{ totalTimeSeconds }}</span>
        <span>Total time (formatted): {{ totalTimeFormatted }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, CSSProperties, ref, watch } from 'vue';
import { getAppKey } from '../../../components/settings';
import {
  clearToken,
  getPowerupId,
  getTrelloCard,
  getTrelloInstance
} from '../../../components/trello';
import UIButton from '../../../components/UIButton.vue';
import UIDropdown, { Option } from '../../../components/UIDropdown.vue';
import { Trello } from '../../../types/trello';
import {
  formatDateTime,
  formatMemberName,
  formatTime
} from '../../../utils/formatting';
import { ApiCard, ApiCardRowData } from './ApiCard';
import UIDateInput from '../../../components/UIDateInput.vue';
import { Ranges } from '../../../components/ranges';
import { Range } from '../../../components/range';
import { ExportToCsv } from 'export-to-csv';
import UILoader from '../../../components/UILoader.vue';
import { getSubscriptionStatus } from '../../../components/optro';
import UIOptroStatus from '../../../components/UIOptroStatus.vue';
import { setStorage, getStorage } from '../../../utils/local-storage';

interface Settings {
  columns: string[];
}

const isAuthorized = ref(false);
const memberOptions = ref<Option[]>();
const members = ref<string[]>([]);
const boardOptions = ref<Option[]>();
const boards = ref<string[]>([]);
const labels = ref<string[]>([]);
const columns = ref<string[]>([]);
const dateFrom = ref('');
const dateTo = ref('');
const listOptions = ref<Option[]>([]);
const lists = ref<string[]>([]);
const isIncognito = ref(false);
const unrecognizedError = ref(false);
const rejectedAuth = ref(false);
const groupByOptions = ref<Option[]>([
  {
    text: 'Card',
    value: 'card'
  },
  {
    text: 'Member',
    value: 'member'
  },
  {
    text: 'Board',
    value: 'board'
  }
]);
const groupEntities = ref<string[] | undefined>();
const loading = ref(true);
const ready = ref(false);
const hasSubscription = ref(false);
const uniqueLabels = ref<Trello.PowerUp.Label[]>([]);
const defaultColumns: (keyof ApiCardRowData)[] = [
  'board.name',
  'card.title',
  'card.labels',
  'member.name',
  'start_datetime',
  'end_datetime',
  'time_formatted'
];

const powerupId = getPowerupId();

const memberById: {
  [key: string]: Trello.PowerUp.Member;
} = {};

const listById: {
  [key: string]: Trello.PowerUp.List;
} = {};

const settings = computed<Settings>(() => {
  return {
    columns: columns.value
  };
});

watch(settings, () => {
  setStorage('export-time-tracking', settings.value);
});

const currentSettings = getStorage<Settings>('export-time-tracking');

if (currentSettings?.columns) {
  columns.value = currentSettings.columns;
}

const boardNameById: {
  [key: string]: string;
} = {};
const columnStyle: { [key: keyof ApiCardRowData]: CSSProperties } = {
  'card.description': {
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  time_seconds: {
    width: '135px'
  },
  time_formatted: {
    width: '135px'
  }
};

const columnOptions = ref<Option[]>([
  {
    text: 'Board name',
    value: 'board.name'
  },
  {
    text: 'Board id',
    value: 'board.id'
  },
  {
    text: 'List id',
    value: 'list.id'
  },
  {
    text: 'List name',
    value: 'list.name'
  },
  {
    text: 'Card id',
    value: 'card.id'
  },
  {
    text: 'Board name',
    value: 'board.name'
  },
  {
    text: 'Board id',
    value: 'board.id'
  },
  {
    text: 'Card title',
    value: 'card.title'
  },
  {
    text: 'Card description',
    value: 'card.description'
  },
  {
    text: 'Card labels',
    value: 'card.labels'
  },
  {
    text: 'Member id(s)',
    value: 'member.id'
  },
  {
    text: 'Member name(s)',
    value: 'member.name'
  },
  {
    text: 'Start datetime',
    value: 'start_datetime'
  },
  {
    text: 'End datetime',
    value: 'end_datetime'
  },
  {
    text: 'Time (seconds)',
    value: 'time_seconds'
  },
  {
    text: 'Time (formatted)',
    value: 'time_formatted'
  }
]);

let cards: ApiCard[] = [];
const lastDataFetch = ref(0);

// function groupBy<K, V>(array: V[], grouper: (item: V) => K) {
//   return array.reduce((map, item) => {
//     var key = grouper(item)
//     if (!map.has(key)) {
//       map.set(key, [item])
//     } else {
//       map.get(key)?.push(item)
//     }
//     return map
//   }, new Map<K, V[]>())
// }

// function transformMap<K, V, R>(
//   source: Map<K, V>,
//   transformer: (value: V, key: K) => R
// ) {
//   return new Map(
//     Array.from(source, v => [v[0], transformer(v[1], v[0])])
//   )
// }

// let groupedResults = transformMap(
//   groupBy(results, r => r.name),
//   values =>
//     transformMap(
//       groupBy(values, r => r.marker.threads),
//       values =>
//         values
//           .sort(
//             (a, b) =>
//               b.marker.start - a.marker.end
//           )
//           .map(v => ({
//             tests: v.tests,
//             errors: v.errors,
//             latency: v.latency,
//             start: v.marker.start,
//           }))
//     )
// )

const tableHead = computed<Option[]>(() => {
  const selectedColumns =
    columns.value.length > 0 ? columns.value : defaultColumns;
  return columnOptions.value.filter((column) => {
    return selectedColumns.includes(column.value);
  });
});

const filteredCards = computed<ApiCard[]>(() => {
  if (lastDataFetch.value === 0) {
    return [];
  }

  const dateFromUnix = dateFrom.value
    ? Math.floor(new Date(dateFrom.value).getTime() / 1000)
    : 0;
  const dateToUnix = dateTo.value
    ? Math.floor(setTimeMidnight(new Date(dateTo.value)).getTime() / 1000)
    : 0;

  return cards.filter((card) => {
    let ranges = card.ranges;

    if (dateFromUnix) {
      ranges = new Ranges(
        card.data.id,
        ranges.items.filter(
          (item) => item.start >= dateFromUnix || item.end >= dateFromUnix
        )
      );
    }

    if (dateToUnix) {
      ranges = new Ranges(
        card.data.id,
        ranges.items.filter(
          (item) => item.start <= dateToUnix || item.end <= dateToUnix
        )
      );
    }

    if (labels.value.length > 0) {
      let labelFound = false;

      labels.value.forEach((selectedLabel) => {
        if (card.data.labels.find((label) => label.id === selectedLabel)) {
          labelFound = true;
        }
      });

      if (!labelFound) {
        return false;
      }
    }

    if (lists.value.length > 0) {
      let listFound = false;

      lists.value.forEach((selectedList) => {
        if (card.data.idList === selectedList) {
          listFound = true;
        }
      });

      if (!listFound) {
        return false;
      }
    }

    return ranges.timeSpent > 0;
  });
});

let rowCounter = 0;
const rowDataList = computed<ApiCardRowData[]>(() => {
  const rowData: ApiCardRowData[] = [];

  filteredCards.value.forEach((card) => {
    const rowDataItem = card.rowData.value;

    const dateFromUnix = dateFrom.value
      ? Math.floor(new Date(dateFrom.value).getTime() / 1000)
      : 0;
    const dateToUnix = dateTo.value
      ? Math.floor(setTimeMidnight(new Date(dateTo.value)).getTime() / 1000)
      : 0;

    let ranges = card.ranges;

    if (dateFromUnix) {
      ranges = new Ranges(
        card.data.id,
        ranges.items.filter(
          (item) => item.start >= dateFromUnix || item.end >= dateFromUnix
        )
      );
    }

    if (dateToUnix) {
      ranges = new Ranges(
        card.data.id,
        ranges.items.filter(
          (item) => item.start <= dateToUnix || item.end <= dateToUnix
        )
      );
    }

    if (members.value.length > 0) {
      ranges = new Ranges(
        card.data.id,
        ranges.items.filter((item) => members.value.includes(item.memberId))
      );
    }

    if (ranges.timeSpent > 0) {
      const membersInrange = ranges.items
        .map((range) => range.memberId)
        .filter((value, index, self) => {
          return self.indexOf(value) === index;
        });

      const timeSpent = ranges.items.reduce((a, b) => a + b.diff, 0);

      let furthestBack = ranges.items.reduce<number | null>((carry, item) => {
        if (carry === null || item.start < carry) {
          carry = item.start;
        }

        return carry;
      }, null);

      let furthestAhead = ranges.items.reduce<number | null>((carry, item) => {
        if (carry === null || item.start > carry) {
          carry = item.end;
        }

        return carry;
      }, null);

      // if(groupEntities.value?.includes("card")) {
      //     if (timeSpent > 0) {
      //       rowCounter++;
      //       rowData.push({
      //         ...rowDataItem,
      //         id: rowCounter,
      //         'member.id': membersInrange.join(', '),
      //         'member.name': membersInrange
      //           .map((memberId) => formatMemberName(memberById[memberId]))
      //           .join(', '),
      //         start_datetime: furthestBack
      //           ? formatDateTime(new Date(furthestBack * 1000))
      //           : 'N/A',
      //         end_datetime: furthestAhead
      //           ? formatDateTime(new Date(furthestAhead * 1000))
      //           : 'N/A',
      //         time_seconds: timeSpent,
      //         time_formatted: formatTime(timeSpent, true)
      //       });
      //     }
      //   }
      //   if (groupEntities.value?.includes("member")) {
      //     ranges.items
      //       .map((range) => range.memberId)
      //       .filter((value, index, self) => {
      //         return self.indexOf(value) === index;
      //       })
      //       .forEach((memberId) => {
      //         let ranges = card.ranges;

      //         if (dateFromUnix) {
      //           ranges = new Ranges(
      //             card.data.id,
      //             ranges.items.filter(
      //               (item) =>
      //                 item.start >= dateFromUnix || item.end >= dateFromUnix
      //             )
      //           );
      //         }

      //         if (dateToUnix) {
      //           ranges = new Ranges(
      //             card.data.id,
      //             ranges.items.filter(
      //               (item) => item.start <= dateToUnix || item.end <= dateToUnix
      //             )
      //           );
      //         }

      //         furthestBack = ranges.items.reduce<number | null>(
      //           (carry, item) => {
      //             if (carry === null || item.start < carry) {
      //               carry = item.start;
      //             }

      //             return carry;
      //           },
      //           null
      //         );

      //         furthestAhead = ranges.items.reduce<number | null>(
      //           (carry, item) => {
      //             if (carry === null || item.start > carry) {
      //               carry = item.end;
      //             }

      //             return carry;
      //           },
      //           null
      //         );

      //         const timeSpent = ranges.items
      //           .filter((item) => item.memberId === memberId)
      //           .reduce((a, b) => a + b.diff, 0);

      //         if (timeSpent > 0) {
      //           rowCounter++;
      //           rowData.push({
      //             ...rowDataItem,
      //             id: rowCounter,
      //             'member.id': memberId,
      //             'member.name': formatMemberName(memberById[memberId]),
      //             start_datetime: furthestBack
      //               ? formatDateTime(new Date(furthestBack * 1000))
      //               : 'N/A',
      //             end_datetime: furthestAhead
      //               ? formatDateTime(new Date(furthestAhead * 1000))
      //               : 'N/A',
      //             time_seconds: timeSpent,
      //             time_formatted: formatTime(timeSpent, true)
      //           });
      //         }
      //       });
      //     }
      //   default:
      ranges.items.forEach((range) => {
        if (range.diff > 0) {
          rowCounter++;
          rowData.push({
            ...rowDataItem,
            id: rowCounter,
            'member.id': range.memberId,
            'member.name': formatMemberName(memberById[range.memberId]),
            // 'card.board_name': boardById[]
            start_datetime: furthestBack
              ? formatDateTime(new Date(range.start * 1000))
              : 'N/A',
            end_datetime: furthestAhead
              ? formatDateTime(new Date(range.end * 1000))
              : 'N/A',
            time_seconds: range.diff,
            time_formatted: formatTime(range.diff, true)
          });
        }
      });
    }
  });

  return rowData;
});

const totalTimeSeconds = computed(() => {
  return rowDataList.value.reduce((a, b) => a + b.time_seconds, 0);
});

const totalTimeFormatted = computed(() => {
  return formatTime(totalTimeSeconds.value, true);
});

const tableBody = computed<ApiCardRowData[]>(() => {
  return rowDataList.value.slice(0, 100);
});

const labelOptions = computed<Option[]>(() => {
  return uniqueLabels.value.map<Option>((label) => {
    return {
      text: label.name,
      value: label.id
    };
  });
});

async function trelloTick() {
  try {
    isAuthorized.value = await getTrelloCard().getRestApi().isAuthorized();
  } catch (e) {
    if (e instanceof Error && e.name === 'restApi::ApiNotConfiguredError') {
      isIncognito.value = true;
    } else {
      unrecognizedError.value = true;
      throw e;
    }
  }
}

function setTimeMidnight(date: Date) {
  date.setHours(23);
  date.setMinutes(59);
  date.setSeconds(59);
  return date;
}

function getUniqueLabels() {
  const newLabels: Trello.PowerUp.Label[] = [];

  cards.forEach((card) => {
    if (card.data.labels.length > 0) {
      card.data.labels.forEach((label) => {
        if (!newLabels.find((labelItem) => labelItem.id === label.id)) {
          newLabels.push(label);
        }
      });
    }
  });

  uniqueLabels.value = newLabels;
}

async function getData() {
  const getDataStart = Date.now();

  loading.value = true;
  const token = await getTrelloCard().getRestApi().getToken();
  const currentMember = await getTrelloInstance().member('id');

  try {
    const boardOptionsList = await fetch(
      `https://api.trello.com/1/members/${
        currentMember.id
      }/boards?fields=id,name&key=${getAppKey()}&token=${token}&r=${new Date().getTime()}`
    ).then<{ id: string; name: string }[]>((res) => res.json());

    boardOptions.value = boardOptionsList.map<Option>((board) => {
      boardNameById[board.id] = board.name;
      return {
        value: board.id,
        text: board.name
      };
    });

    const cardsRequests = boards.value.map((board) => {
      // double encode quotes to %252C because otherwise there's a clash with batch
      return `/boards/${board}/cards/all?pluginData=true&fields=id%252CidList%252CidBoard%252Cname%252Cdesc%252Clabels%252CpluginData%252Cclosed`;
    });
    // use batch request to reduce latency
    // funky way to compose urls field to avoid comma conflict with internal request urls
    const cardsFetchUri =
      new URL(
        `https://api.trello.com/1/batch?key=${getAppKey()}&token=${token}&r=${new Date().getTime()}&urls=`
      ) + cardsRequests.join('&urls=');

    const data = await fetch(cardsFetchUri)
      .then<{ 200: Trello.PowerUp.Card[] }[]>((res) => {
        if (!res.ok) {
          throw new Error(
            'Request for cards failed with status: ' + res.statusText
          );
        }
        return res.json();
      })
      .then((array) => {
        return array
          .map((elem) => {
            if ('200' in elem) {
              return elem['200'];
            } else {
              throw new Error(
                'Fetching cards data from one or more boards failed.'
              );
            }
          })
          .flat();
      });

    const boardData = await fetch(
      `https://api.trello.com/1/boards/${
        board.id
      }?fields=name&key=${getAppKey()}&token=${token}&r=${new Date().getTime()}`
    ).then<Trello.PowerUp.Board>((res) => res.json());

    cards = data.map<ApiCard>((card) => {
      return new ApiCard(boardData, card, listById, memberById, members);
    });

    lastDataFetch.value = Date.now();

    getUniqueLabels();
  } catch (err: unknown) {
    if (err instanceof Error) {
      getTrelloCard().alert({ message: err.message, duration: 5 });
    }

    await getTrelloCard().getRestApi().clearToken();

    await trelloTick();
  }

  await new Promise((resolve) =>
    setTimeout(resolve, Math.min(1500, Date.now() - getDataStart))
  );

  loading.value = false;
  ready.value = true;
}

async function initialize() {
  const board = await getTrelloInstance().board('members');
  const currentBoard = await getTrelloInstance().board('id');
  boards.value = [currentBoard.id];
  // Get the initial subscription status
  hasSubscription.value = await getSubscriptionStatus();

  // Re-fresh subscription status every 5 minute
  setInterval(async () => {
    hasSubscription.value = await getSubscriptionStatus();
  }, 60 * 1000 * 5);

  board.members.forEach((member) => {
    memberById[member.id] = member;
  });

  listOptions.value = (
    await getTrelloInstance().lists('id', 'name')
  ).map<Option>((list) => {
    listById[list.id] = list;

    return {
      text: list.name,
      value: list.id
    };
  });

  memberOptions.value = board.members
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
    .map<Option>((member) => {
      return {
        value: member.id,
        text: formatMemberName(member)
      };
    });

  if (isAuthorized.value) {
    await getData();
  } else {
    ready.value = true;
    loading.value = false;
  }
}

async function authorize() {
  rejectedAuth.value = false;

  try {
    await getTrelloCard().getRestApi().authorize({
      scope: 'read',
      expiration: 'never'
    });

    await trelloTick();
    await getData();
  } catch (e) {
    if (e instanceof Error && e.name === 'restApi::AuthDeniedError') {
      rejectedAuth.value = true;
      return;
    }

    await clearToken();
    throw e;
  }
}

const exportData = () => {
  const data: Array<Array<string>> = [];

  const csvExporter = new ExportToCsv({
    fieldSeparator: ',',
    quoteStrings: '"',
    decimalSeparator: '.',
    showLabels: true,
    useTextFile: false,
    filename: 'activity-timer-trackings',
    useBom: true
  });

  data.push(
    tableHead.value.map((headItem) => {
      return headItem.text;
    })
  );

  rowDataList.value.forEach((rowData) => {
    const row: Array<string> = [];

    tableHead.value.forEach((headItem) => {
      row.push((rowData[headItem.value] ?? '').toString());
    });

    data.push(row);
  });

  csvExporter.generateCsv(data);
};

trelloTick().then(() => {
  initialize();
  getTrelloCard().render(trelloTick);
});
</script>

<style lang="scss" scoped>
.requires-pro {
  text-align: center;

  p {
    margin-top: 0;
  }
}

.unauthorized {
  max-width: 475px;
  text-align: center;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.authorized {
  padding: 25px;
  padding-bottom: 62px;
}

.header {
  &__filters {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;

    label:first-child {
      margin-top: 0;
    }

    .form-element {
      margin: 0 15px 0 0;

      &:last-child {
        margin-right: 0;
      }
    }
  }

  .form-element {
    width: 200px;
    flex-grow: 0;
    flex-shrink: 1;
    min-width: 200px;
  }
}

table {
  margin-top: 25px;
}

.footer {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  border-top: 2px solid #dfe1e6;
  padding: 14px;
  background-color: #fff;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;

  button {
    margin: 0 0 0 15px;

    &:first-child {
      margin-left: 0;
    }
  }

  span {
    margin-left: 15px;

    &:first-child {
      margin-left: 0;
    }
  }
}

p {
  margin: 25px 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

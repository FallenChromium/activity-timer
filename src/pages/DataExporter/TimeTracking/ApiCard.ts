import { computed, ComputedRef, Ref } from 'vue';
import { Estimate } from '../../../components/estimate';
import { Estimates } from '../../../components/estimates';
import { Range } from '../../../components/range';
import { Ranges } from '../../../components/ranges';
import { Trello } from '../../../types/trello';
import {
  formatDateTime,
  formatMemberName,
  formatTime
} from '../../../utils/formatting';

interface PluginRawData {
  'act-timer-ranges': [string, number, number, string][];
  'act-timer-estimates': [string, number][];
}

interface MemberById {
  [key: string]: Trello.PowerUp.Member;
}

interface ListById {
  [key: string]: Trello.PowerUp.List;
}

interface BoardNameById {
  [key: string]: string
}

export interface ApiCardRowData {
  [key: string]: string | string[] | number;
  id: number | string;
  'board.name': string;
  'board.id': string;
  'card.id': string;
  'card.title': string;
  'card.description': string;
  'card.labels': string;
  'list.id': string;
  'list.name': string;
  'member.id': string;
  'member.name': string;
  start_datetime: string;
  end_datetime: string;
  time_seconds: number;
  time_formatted: string;
  estimate_seconds: number;
  estimate_formatted: string;
}

// class ApiCardRanges extends Ranges {
//   private _boardId: string
//   constructor(cardId: string, items?: Range[]) {
//     super(cardId, items)
//   }
// }

export class ApiCard {
  private _boardData: Trello.PowerUp.Board;
  private _data: Trello.PowerUp.Card;
  private _ranges: Ranges;
  private _estimates: Estimates;
  private _rowData: ComputedRef<ApiCardRowData>;
  private _memberById: MemberById;
  private _listById: ListById;

  constructor(
    boardData: Trello.PowerUp.Board,
    data: Trello.PowerUp.Card,
    listById: ListById,
    memberById: MemberById,
    selectedMembers: Ref<string[]>
  ) {
    this._boardData = boardData;
    this._data = data;

    const pluginData = data.pluginData.filter((pluginData) => {
      return (
        pluginData.value &&
        (pluginData.value.includes('act-timer-ranges') ||
          pluginData.value.includes('act-timer-estimates'))
      );
    });

    this._ranges = new Ranges(this._data.id);
    this._estimates = new Estimates(this._data.id, []);

    if (pluginData.length > 0) {
      for (const data of pluginData) {
        const parsedPluginData = JSON.parse(data.value) as PluginRawData;

        if (
          parsedPluginData['act-timer-ranges'] &&
          parsedPluginData['act-timer-ranges'].length > 0
        ) {
          this._ranges = new Ranges(this._data.id, this._ranges.items.concat(
            parsedPluginData['act-timer-ranges'].map((rangeData) => {
              return new Range(
                // Member id
                rangeData[0],

                // Start
                rangeData[1],

                // End
                rangeData[2],

                // Comment
                rangeData[3]
              );
            })
          ));
        }

        if (parsedPluginData['act-timer-estimates']) {
          this._estimates = new Estimates(
            this._data.id,
            this._estimates.items.concat(parsedPluginData['act-timer-estimates'].map((estimate) => {
              return new Estimate(
                // Member id
                estimate[0],

                // Time in seconds
                estimate[1]
              );
            })
            ));
        }
      }
    }

    this._memberById = memberById;
    this._listById = listById;
    this._rowData = computed<ApiCardRowData>(() => {
      const ranges =
        selectedMembers.value.length > 0
          ? new Ranges(
            this._data.id,
            this._ranges.items.filter((item) =>
              selectedMembers.value.includes(item.memberId)
            )
          )
          : this._ranges;

      const timeSpent = ranges.timeSpent;

      const members = ranges.items
        .map((item) => item.memberId)
        .filter((value, index, self) => {
          return self.indexOf(value) === index;
        });

      const furthestBack = ranges.items.reduce<number | null>((carry, item) => {
        if (carry === null || item.start < carry) {
          carry = item.start;
        }

        return carry;
      }, null);

      const furthestAhead = ranges.items.reduce<number | null>(
        (carry, item) => {
          if (carry === null || item.start > carry) {
            carry = item.end;
          }

          return carry;
        },
        null
      );
      return {
        id: this._data.id,
        'board.name': this._boardData.name,
        'board.id': this._boardData.id,
        'card.id': this._data.id,
        'card.title': this._data.name,
        'card.description': this._data.desc,
        'card.labels': this._data.labels.map((label) => label.name).join(', '),
        'list.id': this._data.idList,
        'list.name': this._listById[this._data.idList]?.name ?? 'N/A',
        start_datetime: furthestBack
          ? formatDateTime(new Date(furthestBack * 1000))
          : 'N/A',
        end_datetime: furthestAhead
          ? formatDateTime(new Date(furthestAhead * 1000))
          : 'N/A',
        'member.id': members.join(', '),
        'member.name': members
          .filter((member) => {
            return this._memberById[member] !== undefined;
          })
          .map((member) => {
            return formatMemberName(this._memberById[member]);
          })
          .join(', '),
        time_seconds: timeSpent,
        time_formatted: formatTime(timeSpent, true),
        estimate_seconds: this._estimates.totalEstimate,
        estimate_formatted: formatTime(this._estimates.totalEstimate, true)
      };
    });
  }

  get data() {
    return this._data;
  }

  get ranges() {
    return this._ranges;
  }

  get estimates() {
    return this._estimates;
  }

  get rowData() {
    return this._rowData;
  }
}

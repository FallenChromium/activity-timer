import { Card } from '../../../components/card';
import { Ranges } from '../../../components/ranges';
import { Range } from '../../../components/range';
import { Trello } from '../../../types/trello';
import {
  formatDateTime,
  formatMemberName,
  formatTime
} from '../../../utils/formatting';
import { getMemberId } from '../../../components/trello';

async function promptDateTime(
  t: Trello.PowerUp.IFrame,
  options: {
    title: string;
    closeOnPick?: boolean;
    onPick: (t: Trello.PowerUp.IFrame, datetime: Date) => void;
    initialValue?: Date;
  }
): Promise<void> {
  return t.popup({
    title: options.title,
    url: './index.html',
    args: {
      page: 'datetime',
      ...(options.initialValue && {
        initialValue: options.initialValue.getTime()
      }),
      closeOnPick: options.closeOnPick ?? true ? '1' : '0'
    },
    callback: (t: Trello.PowerUp.IFrame) => {
      const datetimeValue = localStorage.getItem('datetimeValue');
      const datetimeValueInitially = localStorage.getItem(
        'datetimeValueInitially'
      );

      if (!datetimeValue) {
        return;
      }

      if (
        options.initialValue &&
        options.initialValue.getTime() !== Number(datetimeValueInitially)
      ) {
        return;
      }

      options.onPick(t, new Date(Number(datetimeValue)));
    },
    height: 357
  });
}

function getManageRow(
  card: Card,
  ranges: Ranges,
  range: Range
): Trello.PowerUp.PopupOptionsItem {
  const start = new Date(range.start * 1000);
  const end = new Date(range.end * 1000);
  const rangeOnTheSameDay = start.toDateString() === end.toDateString();
  const rangeLengthInSeconds = range.end - range.start;

  return {
    text: `${formatDateTime(start)} - ${formatDateTime(
      end,
      rangeOnTheSameDay
    )} (${formatTime(rangeLengthInSeconds, false)})`,
    callback: function (t) {
      return t.popup({
        title: 'Edit time range',
        items: async function () {
          return [
            {
              text: 'Delete',
              callback: async (t) => {
                return t.popup({
                  type: 'confirm',
                  title: 'Delete tracking',
                  message:
                    "You're about to delete a time tracking. Are you sure?",
                  confirmText: 'Yes, delete tracking',
                  onConfirm: async (t) => {
                    const newRanges = new Ranges(
                      card.id,
                      ranges.items.filter(
                        (item) => item.rangeId !== range.rangeId
                      )
                    );
                    await newRanges.save();
                    return t.closePopup();
                  },
                  confirmStyle: 'danger',
                  cancelText: 'No, cancel'
                });
              }
            }
          ];
        }
      });
    }
  };
}

export async function manageTimeCallback(t: Trello.PowerUp.IFrame) {
  return t.popup({
    title: 'Manage time',
    items: async function (t) {
      const card = await Card.getFromContext(t);
      const timers = await card.getTimers();
      const ranges = await card.getRanges();
      const board = await t.board('members');

      const items: Trello.PowerUp.PopupOptionsItem[] = [];
      const memberIds = board.members.map((member) => member.id);

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
          const memberRanges = ranges.items.filter((range) => {
            return range.memberId === member.id;
          });

          const timer = timers.getByMemberId(member.id);

          if (memberRanges.length > 0 || timer) {
            items.push({
              text: formatMemberName(member) + ':'
            });

            memberRanges.forEach((range) => {
              items.push(getManageRow(card, ranges, range));
            });

            if (timer) {
              items.push({
                text: `Running: ${formatDateTime(
                  new Date(timer.start * 1000)
                )} (${formatTime(timer.timeInSecond, true)})`,
                callback: function (t) {
                  return t.popup({
                    title: 'Active timer',
                    items: async function () {
                      return [
                        {
                          text: 'Stop time tracking',
                          callback: async (t) => {
                            return t.popup({
                              type: 'confirm',
                              title: 'Stop time tracking',
                              message:
                                "You're about to stop a time tracking. Are you sure?",
                              confirmText: 'Yes, stop timer',
                              onConfirm: async (t) => {
                                await card.stopTrackingByMemberId(member.id, t);
                                return t.closePopup();
                              },
                              confirmStyle: 'danger',
                              cancelText: 'No, cancel'
                            });
                          }
                        }
                      ];
                    }
                  });
                }
              });
            }

            const timeSpent =
              memberRanges.reduce((a, b) => a + b.diff, 0) +
              (timer ? timer.timeInSecond : 0);

            items.push({
              text: `Time spent: ${formatTime(timeSpent)}`
            });

            items.push({
              text: '--------'
            });
          }
        });

      ranges.items
        .filter((range) => memberIds.indexOf(range.memberId) === -1)
        .forEach((range) => {
          items.push({
            text: 'N/A:'
          });

          items.push(getManageRow(card, ranges, range));

          items.push({
            text: '--------'
          });
        });

      if (items.length > 0) {
        items.splice(items.length - 1, 1);
      }

      if (items.length > 0) {
        items.push({
          text: '--------'
        });

        items.push({
          text: 'Clear',
          callback: async (t) => {
            return t.popup({
              type: 'confirm',
              title: 'Clear time',
              message: 'Do you wish to clear tracked time?',
              confirmText: 'Yes, clear tracked time',
              onConfirm: async (t) => {
                await t.remove('card', 'shared', 'act-timer-ranges');
                await t.remove('card', 'shared', 'act-timer-running');
                await t.closePopup();
              },
              confirmStyle: 'danger',
              cancelText: 'No, cancel'
            });
          }
        });
      } else {
        items.push({ text: 'No activity yet' });
      }

      return items;
    }
  });
}

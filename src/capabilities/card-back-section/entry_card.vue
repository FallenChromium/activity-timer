<template>
    <UIRow>
        <div class="range-card">
            <div class="card-avatar">
                <div class="avatar-image" :style="{ backgroundImage: `url(${member_avatar})` }" :src="member_avatar"></div>
            </div>
            <div class="card-body">
                <div class="card-title">
                    <b>{{ member_name }}</b> logged {{ logged_time_display }}
                </div>
                <div class="card-comment" v-if="range.comment != null && range.comment != ''">
                    {{ range.comment }}
                </div>
                <div class="card-description">
                    {{ logged_time_start_display }} - {{ logged_time_end_display }}
                </div>
            </div>
        </div>
    </UIRow>

</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import { Range } from '../../components/range';
import { formatTime, formatDateTime } from '../../utils/formatting';
import { Trello } from '../../types/trello'
import UIRow from '../../components/UIRow.vue';
const props = defineProps({
    range: {
        type: Range,
        required: true
    },
    members: {
        type: Array as PropType<Array<Trello.PowerUp.Member>>,
        required: false
    }
});

const logged_time_display = computed(() => formatTime(props.range.diff))
const logged_time_start_display = computed(() => formatDateTime(new Date(props.range.start * 1000)))
const logged_time_end_display = computed(() => formatDateTime(new Date(props.range.end * 1000)))
const member = computed(() => props.members?.find(x => x.id === props.range.memberId))
const member_name = computed(() => member.value?.fullName)
const member_avatar = computed(() => member.value?.avatar)
</script>

<style>
.card-avatar {
    min-height: 32px;
    height: 32px;
    width: 32px;
    font-size: 12px;
    margin: 2px 0px 2px 2px;
    background-color: var(--ds-surface-overlay, #ffffff);
    border-radius: 50%;
}

.avatar-image {
    width: inherit;
    height: inherit;
    background-color: transparent;
    background-position: center center;
    background-repeat: no-repeat;
    background-size: cover;
    border-radius: 50%;
}

.range-card {
    display: flex;
    flex-direction: row;
    padding-top: 4px;
    border-radius: 4px;
    width: 100%;
}

.range-card:hover {
    background-color: rgb(234, 236, 239);
}

.card-description {
    height: 20px;
    line-height: 20px;
    display: flex;
    flex-direction: row;
    -moz-box-align: center;
    align-items: center;
    -moz-box-pack: justify;
    justify-content: space-between;
    color: rgb(94, 108, 132);
    font-size: 12px;
    flex: 1 1 0%;
}

.card-body {
    display: flex;
    flex-direction: column;
    padding: 0px 10px 0px 5px;
    overflow: hidden;
    flex: 1 1 0%;
}

.card-comment {
    flex-grow: 1;
    color: rgb(107, 119, 140);
    background-color: rgb(255, 255, 255);
    border-radius: 3px;
    box-shadow: rgba(9, 30, 66, 0.25) 0px 1px 2px -1px, rgba(9, 30, 66, 0.08) 0px 0px 0px 1px;
    display: inline-block;
    margin: 5px 0px;
    padding: 4px;
}
</style>

<template>
  <UIFormElement>
    <label @click="showOptions = !showOptions">{{ label }}<i v-if="help">({{ help }})</i></label>

    <div class="dropdown" :class="{ 'dropdown--active': showOptions }" ref="container">
      <div class="dropdown__selected" @click="showOptions = !showOptions" :title="selected">
        {{ selected || placeholder }}
        <div class="dropdown__selected-clear" @click.stop="clear()" v-if="hasValue">
          <UIIcon icon="clear" />
        </div>
      </div>

      <div class="dropdown__options" :class="{ 'dropdown__options--top': optionsFromTop }" v-if="showOptions"
        ref="optionsContainer">
        <div class="dropdown__option" v-if="multiple && options!.length > 0" @click="selectAll">All</div>
        <div class="dropdown__option" v-for="option in options" :key="option.value" :class="{
          'dropdown__option--selected':  multiple ? selectedBuffer.includes(option.value) : value.includes(option.value)
        }" :title="option.text" @click="toggleOption(option)">
          {{ option.text }}
        </div>
      </div>
    </div>
  </UIFormElement>
</template>

<script lang="ts">
import {
  computed,
  onBeforeUnmount,
  PropType,
  ref,
  defineComponent,
  watch
} from 'vue';
import UIIcon from './UIIcon/UIIcon.vue';
import UIFormElement from './UIFormElement.vue';

export interface Option {
  value: string;
  text: string;
}

export default defineComponent({
  components: { UIFormElement, UIIcon },
  props: {
    modelValue: {
      value: [String, Array as PropType<string[]>],
      required: true
    },
    label: {
      type: String,
      required: true
    },
    options: {
      type: Array as PropType<Option[]>
    },
    multiple: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      required: false
    },
    help: {
      type: String,
      required: false
    }
  },
  setup(props, context) {
    const container = ref<HTMLDivElement | null>(null);
    const optionsContainer = ref<HTMLDivElement | null>(null);

    const showOptions = ref(false);
    const optionsFromTop = ref(false);
    const selectedBuffer = ref<Array<string>>([]);
    const selected = computed(() => {
      if (Array.isArray(props.modelValue)) {
        return props.modelValue
          .map((optionValue) => {
            return (
              props.options?.find((opt) => opt.value === optionValue)?.text ??
              ''
            );
          })
          .join(', ');
      } else if (props.modelValue) {
        return (
          props.options?.find((opt) => opt.value === props.modelValue)?.text ??
          ''
        );
      }

      return '';
    });

    const value = computed(() => {
      if (Array.isArray(props.modelValue)) {
        return props.modelValue;
      }

      return props.modelValue ? [props.modelValue] : [];
    });

    const isInElement = (el: HTMLElement, inElement: HTMLElement) => {
      let elToCheck: HTMLElement = el;

      while (elToCheck.parentElement) {
        if (elToCheck === inElement) {
          return true;
        }

        elToCheck = elToCheck.parentElement;
      }

      return false;
    };

    const hasValue = computed(() => {
      return Array.isArray(props.modelValue)
        ? props.modelValue.length > 0
        : !!props.modelValue;
    });

    const selectAll = () => {
      selectedBuffer.value = props.options!.map(x => x.value)
    }

    const toggleOption = (option: Option) => {
      if (props.multiple) {

        if (selectedBuffer.value.includes(option.value)) {
          selectedBuffer.value.splice(selectedBuffer.value.indexOf(option.value), 1);
        } else {
          selectedBuffer.value.push(option.value);
        }

      } else {
        showOptions.value = false;
        context.emit('update:modelValue', option.value);
        console.log("Updated value at toggle")
      }
    };

    const clear = () => {
      showOptions.value = false;
      context.emit('update:modelValue', props.multiple ? [] : '');
      console.log('Updated value with clear')
    };

    const clickAwayDetection = (e: MouseEvent) => {
      if (
        showOptions.value &&
        e.target instanceof HTMLElement &&
        container.value &&
        container.value instanceof HTMLDivElement &&
        isInElement(e.target, container.value) &&
        (e.target.classList.contains('dropdown__selected') ||
          e.target.nodeName.toLowerCase() === 'label')
      ) {
        return;
      }

      if (
        showOptions.value &&
        optionsContainer.value &&
        e.target instanceof HTMLElement &&
        optionsContainer.value instanceof HTMLDivElement &&
        !isInElement(e.target, optionsContainer.value)
      ) {
        showOptions.value = false;
        return;
      }

      if (
        showOptions.value &&
        optionsContainer.value &&
        e.target instanceof HTMLElement &&
        optionsContainer.value instanceof HTMLDivElement &&
        isInElement(e.target, optionsContainer.value) &&
        !e.target.classList.contains('dropdown__option')
      ) {
        showOptions.value = false;
      }
    };

    watch(showOptions, () => {
      if (showOptions.value && container.value) {
        const rect = container.value.getBoundingClientRect();
        optionsFromTop.value = window.innerHeight < rect.bottom + 75;

        if (props.multiple) {
          // update buffer with the latest value
          selectedBuffer.value = value.value
          console.log('Updated buffer with the current value')
        }
        
      }
      // set value to the buffer value after the dropdown has closed
      // reduces reactivity but also helps UX, less useless computations being made on intermediate values
      if (!showOptions.value && props.multiple) {
        console.log(props.modelValue)
        console.log(selectedBuffer.value)
        if (props.modelValue != selectedBuffer.value) {
          context.emit('update:modelValue', selectedBuffer.value);
          console.log('Updated value with buffer sync')
        }
      }
    });
    watch(value.value, () => {
      console.log('New value:', value.value);
    });

    window.addEventListener('click', clickAwayDetection);

    onBeforeUnmount(() => {
      window.removeEventListener('click', clickAwayDetection);
    });

    return {
      showOptions,
      selected,
      clear,
      hasValue,
      value,
      selectedBuffer,
      toggleOption,
      selectAll,
      container,
      optionsContainer,
      optionsFromTop
    };
  }
});
</script>

<style lang="scss" scoped>
label {
  user-select: none;
  white-space: nowrap;

  i {
    display: inline-block;
    font-weight: normal;
    margin-left: 6px;
  }
}

.dropdown {
  position: relative;
  width: 100%;
  max-width: 250px;

  &__selected {
    display: block;
    width: 100%;
    height: 38px;
    line-height: 38px;
    padding: 0 30px 0 14px;
    box-shadow: inset 0 0 0 2px #dfe1e6;
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #172b4d;
    background-color: #fafbfc;

    &-clear {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 30px;
      cursor: pointer;
      text-align: center;
    }
  }

  &__options {
    position: absolute;
    left: 0;
    top: 100%;
    width: 100%;
    border: 1px solid #dfe1e6;
    border-top: none;
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    z-index: 10;
    background-color: #fff;
    max-height: 175px;
    overflow: auto;

    &--top {
      top: auto;
      bottom: 100%;
      border: 1px solid #dfe1e6;
      border-bottom: none;
      border-top-left-radius: 4px;
      border-top-right-radius: 4px;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.15);
    }

    &::-webkit-scrollbar-thumb {
      background-color: #6c6c6c;
    }
  }

  &__option {
    padding: 5px 14px;
    line-height: 24px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    color: #5e6c84;

    &:hover {
      background-color: #dfe1e6;
    }

    &--selected {
      background-color: #a1a3a7 !important;
      color: #fff !important;
    }
  }
}
</style>

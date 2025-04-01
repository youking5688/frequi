<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { Trade } from '@/types';
import { useBotStore } from '@/stores/ftbotwrapper';

const props = defineProps({
  trade: {
    type: Object as () => Trade,
    required: true,
  },
  stakeCurrencyDecimals: {
    type: Number,
    required: true,
  },
});

const model = defineModel<boolean>();
const botStore = useBotStore();
const form = ref<HTMLFormElement>();
const amount = ref<number>(0);
const availableBalance = ref<number>(0);
const currentTime = ref(new Date());
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirmAdjustPosition', payload: {
    amount: number;
    botId: string;
    trade_id: string
  }): void;
}>();
let timer: number;


const formatDuration = (startDate: Date) => {
  const now = currentTime.value;
  const diff = now.getTime() - startDate.getTime();

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const timeParts = [];
  if (days > 0) timeParts.push(`${days}d `);
  if (hours > 0) timeParts.push(`${hours}:`);
  timeParts.push(`${minutes}:`);
  timeParts.push(`${seconds}`);
  return timeParts.join('');
};

const holdingTime = computed(() => {
  if (!props.trade?.open_date) return "0天0小时0分0秒";
  const openDate = new Date(props.trade.open_date);
  return formatDuration(openDate);
});

const calculatedAmount = computed(() => {
  return amount.value && props.trade?.current_rate
    ? Number(amount.value) * props.trade.current_rate
    : 0;
});
/*              计算补仓后的盈亏
检查数据是否有效（amount、current_rate、open_rate）
计算总持仓量 = 原持仓量 + 补仓量
计算补仓后的平均开仓价
判断交易方向（多头 long 或空头 short）
    多头（long）： 盈亏 = (当前价 - 均价) * 总持仓量
    空头（short）： 盈亏 = (均价 - 当前价) * 总持仓量
返回盈亏，保留两位小数
数据无效时，返回 "0.00"
 */
const profitAfterAdjustment = computed(() => {
  if (amount.value && props.trade?.current_rate && props.trade?.open_rate) {
    const totalAmount = props.trade.amount + Number(amount.value);
    const averagePrice =
      (props.trade.amount * props.trade.open_rate + Number(amount.value) * props.trade.current_rate) / totalAmount;

    const isShort = props.trade.is_short;
    const profit = isShort
      ? (averagePrice - props.trade.current_rate) * totalAmount
      : (props.trade.current_rate - averagePrice) * totalAmount;

    return profit;
  }
  return 0;
});

// Methods
const fetchBalance = async () => {
  try {
    const balanceData = await botStore.activeBot.getBalance();
    if (balanceData?.currencies) {
      const usdtBalance = balanceData.currencies.find((c: any) => c.currency === "USDT");
      availableBalance.value = usdtBalance?.free ?? 0;
    } else {
      availableBalance.value = 0;
    }
  } catch (error) {
    console.error('获取可用资金失败:', error);
    availableBalance.value = 0;
  }
};



const checkFormValidity = () => {
  return form.value?.checkValidity();
};

async function handleSubmit() {
  if (!checkFormValidity()) return;

  // if (amount.value === props.trade.amount) {
  //   alert('补仓数量未更改');
  //   return;
  // }

  if (!amount.value || amount.value <= 0) {
    alert('补仓数量必须大于 0');
    return;
  }
  console.log('handleSubmit', amount.value, props.trade.botId, props.trade.trade_id);

  emit('confirmAdjustPosition', { amount: amount.value, botId: props.trade.botId, trade_id: props.trade.trade_id  });
  model.value = false;
}

// Lifecycle hooks
onMounted(() => {
  timer = window.setInterval(() => {
    currentTime.value = new Date();
  }, 1000);
});

onUnmounted(() => {
  clearInterval(timer);
});

// Watchers
watch(
  () => model.value,
  async (newValue) => {
    if (newValue) {
      await fetchBalance();
    }
  }
);
const resetForm = () => {
  amount.value = props.trade.amount;
};

</script>

<template>
  <Dialog
    :visible="model"
    header="补仓"
    @show="resetForm"
    @hide="resetForm"
    style="width: 900px;background: rgba(0,0,0,.8);color:white"
  >
    <form ref="form" class="space-y-4" @submit.prevent="handleSubmit">
      <div class="grid grid-cols-2 gap-4">
        <!-- Left Column -->
        <div class="space-y-4">
          <div>
            <label class="block font-medium mb-1">持仓数量</label>
            <div class="flex items-center space-x-2">
              <InputText :value="trade.amount" readonly class="w-full" />
              <small class="bg-gray-200 text-gray-800 px-2 py-1 rounded-md">
                {{ trade.base_currency }}
              </small>
            </div>
          </div>

          <div>
            <label class="block font-medium mb-1">开仓价格</label>
            <InputText :value="trade.open_rate" readonly class="w-full" />
          </div>

          <div>
            <label class="block font-medium mb-1">持仓金额</label>
            <div class="flex items-center space-x-2">
              <InputText :value="trade.stake_amount" readonly class="w-full" />
              <small class="bg-gray-200 text-gray-800 px-2 py-1 rounded-md">
                {{ trade.quote_currency }}
              </small>
            </div>
          </div>

          <div>
            <label class="block font-medium mb-1">杠杆</label>
            <InputText :value="`${trade.leverage || 1}X`" readonly class="w-full" />
          </div>

          <div>
            <label class="block font-medium mb-1">持仓时间</label>
            <InputText :value="holdingTime" readonly class="w-full" />
          </div>

          <div>
            <label class="block font-medium mb-1">盈亏</label>
            <InputText :value="trade.total_profit_abs" readonly class="w-full" />
          </div>
        </div>

        <!-- Right Column -->
        <div class="space-y-4">
          <div>
            <label class="block font-medium mb-1">可用资金</label>
            <div class="flex items-center space-x-2">
              <InputText :value="availableBalance" readonly class="w-full" />
              <small class="bg-gray-200 text-gray-800 px-2 py-1 rounded-md">USDT</small>
            </div>
          </div>

          <div>
            <label class="block font-medium mb-1">现价</label>
            <InputText :value="trade.current_rate" readonly class="w-full" />
          </div>

          <div>
            <label class="block font-medium mb-1">补仓数量</label>
            <div class="flex items-center space-x-2">
              <InputNumber
                v-model="amount"
                class="w-full"
              />
              <small class="bg-gray-200 text-gray-800 px-2 py-1 rounded-md">
                {{ trade.base_currency }}
              </small>
            </div>
          </div>

          <div>
            <label class="block font-medium mb-1">杠杆</label>
            <InputText :value="`${trade.leverage || 1}X`" readonly class="w-full" />
          </div>

          <div>
            <label class="block font-medium mb-1">金额</label>
            <div class="flex items-center space-x-2">
              <InputText :value="calculatedAmount" readonly class="w-full" />
              <small class="bg-gray-200 text-gray-800 px-2 py-1 rounded-md">
                {{ trade.quote_currency }}
              </small>
            </div>
          </div>

          <div>
            <label class="block font-medium mb-1">盈亏 (补仓后)</label>
            <div class="flex items-center space-x-2">
              <InputText :value="profitAfterAdjustment" readonly class="w-full" />
              <small class="bg-gray-200 text-gray-800 px-2 py-1 rounded-md">
                {{ trade.quote_currency }}
              </small>
            </div>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <div class="flex justify-center gap-2 w-full">
        <Button severity="secondary" @click="model = false" class="w-32">取消</Button>
        <Button severity="primary" @click="handleSubmit" class="w-32">确认</Button>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
:deep(.p-dialog-title){
  color: white !important;
}
</style>

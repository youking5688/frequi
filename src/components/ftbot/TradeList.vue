<script setup lang="ts">
import type { MultiDeletePayload, MultiForcesellPayload, Trade } from '@/types';
import { useBotStore } from '@/stores/ftbotwrapper';
import { useRouter } from 'vue-router';

enum ModalReasons {
  removeTrade,
  forceExit,
  forceExitPartial,
  cancelOpenOrder,
}

const props = defineProps({
  trades: { required: true, type: Array as () => Array<Trade> },
  title: { default: 'Trades', type: String },
  stakeCurrency: { required: false, default: '', type: String },
  activeTrades: { default: false, type: Boolean },
  showFilter: { default: false, type: Boolean },
  multiBotView: { default: false, type: Boolean },
  emptyText: { default: 'No Trades to show.', type: String },
});
const botStore = useBotStore();
const router = useRouter();
const settingsStore = useSettingsStore();
const currentPage = ref(1);
const selectedItemIndex = ref();
const filterText = ref('');
const feTrade = ref<Trade>({} as Trade);
const perPage = props.activeTrades ? 200 : 15;
const tradesTable = ref<HTMLFormElement>();
const forceExitVisible = ref(false);
const removeTradeVisible = ref(false);
const confirmExitText = ref('');
const confirmExitValue = ref<ModalReasons | null>(null);

const increasePosition = ref({ visible: false, trade: {} as Trade });

const adjustPositionVisible = ref(false);

function formatPriceWithDecimals(price) {
  return formatPrice(price, botStore.activeBot.stakeCurrencyDecimals);
}

const tableFields = ref([
  { field: 'trade_id', header: 'ID' },
  { field: 'pair', header: 'Pair' },
  { field: 'amount', header: 'Amount' },
  props.activeTrades
    ? { field: 'stake_amount', header: 'Stake amount' }
    : { field: 'max_stake_amount', header: 'Total stake amount' },
  {
    field: 'open_rate',
    header: 'Open rate',
  },
  {
    field: props.activeTrades ? 'current_rate' : 'close_rate',
    header: props.activeTrades ? 'Current rate' : 'Close rate',
  },
  {
    field: 'profit',
    header: props.activeTrades ? 'Current profit %' : 'Profit %',
  },
  { field: 'open_timestamp', header: 'Open date' },
  ...(props.activeTrades
    ? [{ field: 'actions', header: '' }]
    : [
        { field: 'close_timestamp', header: 'Close date' },
        { field: 'exit_reason', header: 'Close Reason' },
      ]),
]);

if (props.multiBotView) {
  tableFields.value.unshift({ field: 'botName', header: 'Bot' });
}

const feOrderType = ref<string | undefined>(undefined);
function forceExitHandler(item: Trade, ordertype: string | undefined = undefined) {
  feTrade.value = item;
  confirmExitValue.value = ModalReasons.forceExit;
  confirmExitText.value = `Really exit trade ${item.trade_id} (Pair ${item.pair}) using ${ordertype} Order?`;
  feOrderType.value = ordertype;
  if (settingsStore.confirmDialog === true) {
    removeTradeVisible.value = true;
  } else {
    forceExitExecuter();
  }
}

function forceExitExecuter() {
  if (confirmExitValue.value === ModalReasons.removeTrade) {
    const payload: MultiDeletePayload = {
      tradeid: String(feTrade.value.trade_id),
      botId: feTrade.value.botId,
    };
    botStore.deleteTradeMulti(payload).catch((error) => console.log(error.response));
  }
  if (confirmExitValue.value === ModalReasons.forceExit) {
    const payload: MultiForcesellPayload = {
      tradeid: String(feTrade.value.trade_id),
      botId: feTrade.value.botId,
    };
    if (feOrderType.value) {
      payload.ordertype = feOrderType.value;
    }
    botStore
      .forceSellMulti(payload)
      .then((xxx) => console.log(xxx))
      .catch((error) => console.log(error.response));
  }
  if (confirmExitValue.value === ModalReasons.cancelOpenOrder) {
    const payload: MultiDeletePayload = {
      tradeid: String(feTrade.value.trade_id),
      botId: feTrade.value.botId,
    };
    botStore.cancelOpenOrderMulti(payload);
  }

  feOrderType.value = undefined;
  removeTradeVisible.value = false;
}

function removeTradeHandler(item: Trade) {
  confirmExitText.value = `Really delete trade ${item.trade_id} (Pair ${item.pair})?`;
  confirmExitValue.value = ModalReasons.removeTrade;
  feTrade.value = item;
  removeTradeVisible.value = true;
}

function forceExitPartialHandler(item: Trade) {
  feTrade.value = item;
  forceExitVisible.value = true;
}

function cancelOpenOrderHandler(item: Trade) {
  confirmExitText.value = `Cancel open order for trade ${item.trade_id} (Pair ${item.pair})?`;
  feTrade.value = item;
  confirmExitValue.value = ModalReasons.cancelOpenOrder;
  removeTradeVisible.value = true;
}

function reloadTradeHandler(item: Trade) {
  botStore.reloadTradeMulti({ tradeid: String(item.trade_id), botId: item.botId });
}

function handleForceEntry(item: Trade) {
  increasePosition.value.trade = item;
  increasePosition.value.visible = true;
}

const onRowClicked = ({ data: item, index }) => {
  if (props.multiBotView && botStore.selectedBot !== item.botId) {
    // Multibotview - on click switch to the bot trade view
    botStore.selectBot(item.botId);
  }
  if (item && item.trade_id !== botStore.activeBot.detailTradeId) {
    botStore.activeBot.setDetailTrade(item);
    selectedItemIndex.value = index;
    if (props.multiBotView) {
      router.push({ name: 'Freqtrade Trading' });
    }
  } else {
    botStore.activeBot.setDetailTrade(null);
    selectedItemIndex.value = undefined;
  }
};

const shouldHighlightRow = (trade: Trade) => {
  // return trade.profit_ratio && trade.profit_ratio < -0.2;
  return trade.profit_ratio && trade.profit_ratio < -0.1;
};
// 补仓
function adjustPosition(item: Trade) {
  feTrade.value = item;
  adjustPositionVisible.value = true;
  console.log('adjustPositionVisible',adjustPositionVisible.value);

}
// 处理补仓确认
const handleAdjustPositionConfirm = async (adjustData) => {
  console.log('handleAdjustPositionConfirm----补仓数据', adjustData);
  // 解析字符串为数值
  const amount = parseFloat(adjustData.amount);

  if (isNaN(amount)) {
    console.error('补仓数据--转换失败，输入数据无效', adjustData);
    return;
  }
  console.log('转换后的数值:', { amount });
  try {
    // 调用补仓接口
    await botStore.adjustPositionMulti({
      tradeid: adjustData.trade_id,
      botId: adjustData.botId,
      quantity: amount,
    });

    // 补仓成功后，重新加载交易数据
    reloadTradeHandler(feTrade.value);
  } catch (error) {
    console.error('补仓失败:', error);
  }

};

watch(
  () => botStore.activeBot.detailTradeId,
  (val) => {
    const index = props.trades.findIndex((v) => v.trade_id === val);
    // Unselect when another tradeTable is selected!
    if (index < 0) {
      selectedItemIndex.value = undefined;
    }
  },
);
</script>

<template>
  <div class="h-full overflow-auto w-full">
    <DataTable
      ref="tradesTable"
      v-model:selection="selectedItemIndex"
      :value="
        trades.filter(
          (t) =>
            t.pair.toLowerCase().includes(filterText.toLowerCase()) ||
            t.exit_reason?.toLowerCase().includes(filterText.toLowerCase()) ||
            t.enter_tag?.toLowerCase().includes(filterText.toLowerCase()),
        )
      "
      :rows="perPage"
      :paginator="!activeTrades"
      :first="(currentPage - 1) * perPage"
      selection-mode="single"
      data-key="botTradeId"
      class="text-center"
      size="small"
      :scrollable="true"
      scroll-height="flex"
      @row-click="onRowClicked"
      :row-class="(data) => (shouldHighlightRow(data) ? 'highlight-row' : null)"
    >
      <template #empty>
        {{ emptyText }}
      </template>
      <Column
        v-for="column in tableFields"
        :key="column.field"
        :field="column.field"
        :header="column.header"
      >
        <template #body="{ data, field, index }">
          <template v-if="field === 'trade_id'">
            {{ data.trade_id }}
            {{
              botStore.activeBot.botApiVersion > 2.0 && data.trading_mode !== 'spot'
                ? (data.trade_id ? '| ' : '') + (data.is_short ? 'Short' : 'Long')
                : ''
            }}
          </template>
          <template v-else-if="field === 'pair'">
            {{ `${data.pair}${data.open_order_id || data.has_open_orders ? '*' : ''}` }}
          </template>
          <template v-else-if="field === 'actions'">
            <TradeActionsPopover
              :id="index"
              :enable-force-entry="botStore.activeBot.botState.force_entry_enable"
              :trade="data as Trade"
              :bot-api-version="botStore.activeBot.botApiVersion"
              @delete-trade="removeTradeHandler(data as Trade)"
              @force-exit="forceExitHandler"
              @force-exit-partial="forceExitPartialHandler"
              @cancel-open-order="cancelOpenOrderHandler"
              @reload-trade="reloadTradeHandler"
              @force-entry="handleForceEntry"
              @adjust-position="adjustPosition"
            />
          </template>
          <template v-else-if="field === 'stake_amount'">
            {{ formatPriceWithDecimals(data.stake_amount) }}
            {{ data.trading_mode !== 'spot' ? `(${data.leverage}x)` : '' }}
          </template>
          <template
            v-else-if="field === 'open_rate' || field === 'current_rate' || field === 'close_rate'"
          >
            {{ formatPrice(data[field]) }}
          </template>
          <template v-else-if="field === 'profit'">
            <TradeProfit :trade="data" />
          </template>
          <template v-else-if="field === 'open_timestamp'">
            <DateTimeTZ :date="data.open_timestamp" />
          </template>
          <template v-else-if="field === 'close_timestamp'">
            <DateTimeTZ :date="data.close_timestamp ?? 0" />
          </template>
          <template v-else>
            {{ data[field] }}
          </template>
        </template>
      </Column>

      <template v-if="showFilter" #header>
        <div class="flex justify-end gap-2 p-2">
          <InputText v-model="filterText" placeholder="Filter" class="w-64" size="small" />
        </div>
      </template>
    </DataTable>

    <ForceExitForm
      v-if="activeTrades"
      v-model="forceExitVisible"
      :trade="feTrade"
      :stake-currency-decimals="botStore.activeBot.botState.stake_currency_decimals ?? 3"
    />
    <ForceEntryForm
      v-model="increasePosition.visible"
      :pair="increasePosition.trade?.pair"
      position-increase
    />

    <!-- 补仓弹窗 -->
    <AdjustPositionForm
      v-model="adjustPositionVisible"
      :trade="feTrade"
      @confirmAdjustPosition="handleAdjustPositionConfirm"
    />

    <Dialog v-model:visible="removeTradeVisible" :modal="true" header="Exit trade">
      <p>{{ confirmExitText }}</p>
      <template #footer>
        <Button label="Cancel" @click="removeTradeVisible = false" />
        <Button label="Confirm" severity="danger" @click="forceExitExecuter" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.highlight-row) {
  background-color: rgba(255, 0, 0, 0.2) !important;
}
</style>

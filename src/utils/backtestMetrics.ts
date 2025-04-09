import type { StrategyBacktestResult, Trade } from '@/types';

function getSortedTrades(trades: Trade[]): Trade[] {
  const sortedTrades = trades.slice().sort((a, b) => a.profit_ratio - b.profit_ratio);
  return sortedTrades;
}

function getBestPair(trades: Trade[]) {
  if (trades.length === 0) {
    return 'N/A';
  }
  const value = trades[trades.length - 1];
  return `${value.pair} ${formatPercent(value.profit_ratio, 2)}`;
}

function getWorstPair(trades: Trade[]) {
  if (trades.length === 0) {
    return 'N/A';
  }
  const value = trades[0];
  return `${value.pair} ${formatPercent(value.profit_ratio, 2)}`;
}

function useFormatPriceStake(stake_currency_decimals: number, stake_currency: string) {
  const formatPriceStake = (price) => {
    return `${formatPrice(price, stake_currency_decimals)} ${stake_currency}`;
  };
  return formatPriceStake;
}

export function generateBacktestMetricRows(result: StrategyBacktestResult) {
  const sortedTrades = getSortedTrades(result.trades);
  const bestPair = getBestPair(sortedTrades);
  const worstPair = getWorstPair(sortedTrades);
  const pairSummary = result.results_per_pair[result.results_per_pair.length - 1];

  const formatPriceStake = useFormatPriceStake(
    result.stake_currency_decimals,
    result.stake_currency,
  );

  // Transpose Result into readable format
  const shortMetrics =
    result.trade_count_short && result.trade_count_short > 0
      ? [
          { '___ ': '___' },
          {
            'Long / Short': `${result.trade_count_long} / ${result.trade_count_short}`,
          },
          {
            'Total profit Long': `${formatPercent(
              result.profit_total_long || 0,
            )} | ${formatPriceStake(result.profit_total_long_abs)}`,
          },
          {
            'Total profit Short': `${formatPercent(
              result.profit_total_short || 0,
            )} | ${formatPriceStake(result.profit_total_short_abs)}`,
          },
        ]
      : [];

  const tmp = [
    {
      'Total Profit': `${formatPercent(result.profit_total)} | ${formatPriceStake(
        result.profit_total_abs,
      )}`,
    },
    {
      CAGR: `${result.cagr ? formatPercent(result.cagr) : 'N/A'}`,
    },
    {
      Sortino: `${result.sortino ? result.sortino.toFixed(2) : 'N/A'}`,
    },
    {
      Sharpe: `${result.sharpe ? result.sharpe.toFixed(2) : 'N/A'}`,
    },
    {
      Calmar: `${result.calmar ? result.calmar.toFixed(2) : 'N/A'}`,
    },
    {
      'System Quality Number (SQN)': `${result.sqn ? result.sqn.toFixed(2) : 'N/A'}`,
    },
    {
      [`Expectancy ${result.expectancy_ratio ? '(ratio)' : ''}`]: `${
        result.expectancy
          ? result.expectancy_ratio
            ? result.expectancy.toFixed(2) + ' (' + result.expectancy_ratio.toFixed(2) + ')'
            : result.expectancy.toFixed(2)
          : 'N/A'
      }`,
    },
    {
      'Profit factor': `${result.profit_factor ? formatPrice(result.profit_factor, 3) : 'N/A'}`,
    },
    {
      'Total trades / Daily Avg Trades': `${result.total_trades} / ${result.trades_per_day}`,
    },
    // { 'First trade': result.backtest_fi },
    // { 'First trade Pair': result.backtest_best_day },
    {
      'Best day': `${formatPercent(result.backtest_best_day, 2)} | ${formatPriceStake(
        result.backtest_best_day_abs,
      )}`,
    },
    {
      'Worst day': `${formatPercent(result.backtest_worst_day, 2)} | ${formatPriceStake(
        result.backtest_worst_day_abs,
      )}`,
    },

    {
      'Win/Draw/Loss': `${pairSummary.wins} / ${pairSummary.draws} / ${pairSummary.losses} ${
        isNotUndefined(pairSummary.winrate)
          ? '(WR: ' +
            formatPercent(
              result.results_per_pair[result.results_per_pair.length - 1].winrate ?? 0,
              2,
            ) +
            ')'
          : ''
      }`,
    },
    {
      'Days win/draw/loss': `${result.winning_days} / ${result.draw_days} / ${result.losing_days}`,
    },
    {
      'Avg. Duration winners': humanizeDurationFromSeconds(result.winner_holding_avg_s),
    },
    {
      'Avg. Duration Losers': humanizeDurationFromSeconds(result.loser_holding_avg_s),
    },
    {
      'Max Consecutive Wins / Loss':
        result.max_consecutive_wins === undefined
          ? 'N/A'
          : `${result.max_consecutive_wins} / ${result.max_consecutive_losses}`,
    },
    { 'Rejected entry signals': result.rejected_signals },
    {
      'Entry/Exit timeouts': `${result.timedout_entry_orders} / ${result.timedout_exit_orders}`,
    },
    {
      'Canceled Trade Entries': result.canceled_trade_entries ?? 'N/A',
    },
    {
      'Canceled Entry Orders': result.canceled_entry_orders ?? 'N/A',
    },
    {
      'Replaced Entry Orders': result.replaced_entry_orders ?? 'N/A',
    },

    ...shortMetrics,

    { ___: '___' },
    { 'Min balance': formatPriceStake(result.csum_min) },
    { 'Max balance': formatPriceStake(result.csum_max) },
    { 'Market change': formatPercent(result.market_change) },
    { '___  ': '___' },
    {
      'Max Drawdown (Account)': formatPercent(result.max_drawdown_account),
    },
    {
      'Max Drawdown ABS': formatPriceStake(result.max_drawdown_abs),
    },
    {
      'Drawdown high | low': `${formatPriceStake(result.max_drawdown_high)} | ${formatPriceStake(
        result.max_drawdown_low,
      )}`,
    },
    { 'Drawdown start': timestampms(result.drawdown_start_ts) },
    { 'Drawdown end': timestampms(result.drawdown_end_ts) },
    { '___   ': '___' },

    {
      'Best Pair': `${result.best_pair.key} ${formatPercent(result.best_pair.profit_total)}`,
    },
    {
      'Worst Pair': `${result.worst_pair.key} ${formatPercent(result.worst_pair.profit_total)}`,
    },
    { 'Best single Trade': bestPair },
    { 'Worst single Trade': worstPair },
  ];
  return tmp;
}

function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTradingMode(result: StrategyBacktestResult) {
  if (!result.trading_mode || !result.margin_mode) {
    return {};
  }
  const value =
    result.trading_mode === 'spot'
      ? capitalizeFirstLetter(result.trading_mode)
      : `${capitalizeFirstLetter(result.margin_mode)} ${capitalizeFirstLetter(result.trading_mode)}`;
  return { 'Trading Mode': value };
}

export function generateBacktestSettingRows(result: StrategyBacktestResult) {
  const formatPriceStake = useFormatPriceStake(
    result.stake_currency_decimals,
    result.stake_currency,
  );
  const tradingMode = formatTradingMode(result);

  return [
    { 'Backtesting from': timestampms(result.backtest_start_ts) },
    { 'Backtesting to': timestampms(result.backtest_end_ts) },
    ...(Object.keys(tradingMode).length !== 0 ? [tradingMode] : []),
    {
      'BT execution time': humanizeDurationFromSeconds(
        result.backtest_run_end_ts - result.backtest_run_start_ts,
      ),
    },
    { 'Max open trades': result.max_open_trades },
    { Timeframe: result.timeframe },
    { 'Timeframe Detail': result.timeframe_detail || 'N/A' },
    { Timerange: result.timerange },
    { Stoploss: formatPercent(result.stoploss, 2) },
    { 'Trailing Stoploss': result.trailing_stop },
    {
      'Trail only when offset is reached': result.trailing_only_offset_is_reached,
    },
    { 'Trailing Stop positive': result.trailing_stop_positive },
    {
      'Trailing stop positive offset': result.trailing_stop_positive_offset,
    },
    { 'Custom Stoploss': result.use_custom_stoploss },
    { ROI: JSON.stringify(result.minimal_roi) },
    {
      'Use Exit Signal':
        result.use_exit_signal !== undefined ? result.use_exit_signal : result.use_sell_signal,
    },
    {
      'Exit profit only':
        result.exit_profit_only !== undefined ? result.exit_profit_only : result.sell_profit_only,
    },
    {
      'Exit profit offset':
        result.exit_profit_offset !== undefined
          ? result.exit_profit_offset
          : result.sell_profit_offset,
    },
    { 'Enable protections': result.enable_protections },
    {
      'Starting balance': formatPriceStake(result.starting_balance),
    },
    {
      'Final balance': formatPriceStake(result.final_balance),
    },
    {
      'Avg. stake amount': formatPriceStake(result.avg_stake_amount),
    },
    {
      'Total trade volume': formatPriceStake(result.total_volume),
    },
  ];
}

/** Selectable options for backtest charts.
 * selection happens through the settings page
 */
export const availableBacktestMetrics = ref([
  { field: 'sqn', header: 'SQN' },
  { field: 'cagr', header: 'Cagr' },
  { field: 'calmar', header: 'Calmar' },
  { field: 'expectancy', header: 'Expectancy' },
  { field: 'profit_factor', header: 'Profit Factor' },
  { field: 'sharpe', header: 'Sharpe' },
  { field: 'sortino', header: 'Sortino' },
  { field: 'max_drawdown_account', header: 'Max Drawdown', is_ratio: true },
]);

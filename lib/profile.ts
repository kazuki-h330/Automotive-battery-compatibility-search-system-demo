// 表示用のデータ種別。DBJ 様サンプル検証環境（NEXT_PUBLIC_DATA_PROFILE=dbj-sample）では、
// 入力例を DBJ 様のサンプル CSV に合わせて切り替える。判定処理には影響しない。
export const DBJ_SAMPLE = process.env.NEXT_PUBLIC_DATA_PROFILE === "dbj-sample";

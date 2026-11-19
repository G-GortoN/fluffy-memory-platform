import { ApiError } from './api';
import type { Locale } from './language';
import { localizeSeedText } from './localized-content';

const messages = new Map<string, readonly [string, string]>([
  ['邮箱或密码有误', ['The email address or password is incorrect.', '電郵地址或密碼不正確。']],
  ['邮箱已注册', ['An account already uses this email address.', '此電郵地址已登記帳戶。']],
  ['请先登录', ['Please sign in first.', '請先登入。']],
  ['你没有权限执行此操作，或会话已过期', ['You do not have permission, or your session has expired.', '你沒有權限執行此操作，或登入已逾時。']],
  ['宠物档案不存在', ['This pet profile could not be found.', '找不到這個寵物檔案。']],
  ['照片不存在', ['This photo could not be found.', '找不到這張相片。']],
  ['请先上传照片', ['Upload a photo first.', '請先上載相片。']],
  ['照片地址无效', ['The photo address is invalid.', '相片連結無效。']],
  ['请选择 JPG 或 PNG 照片', ['Choose a JPG or PNG photo.', '請選擇 JPG 或 PNG 相片。']],
  ['照片像素过大，请缩小尺寸后重新上传', ['Resize the photo before uploading it again.', '相片像素過高，請縮小尺寸後重新上載。']],
  ['无法读取照片，请重新上传', ['The photo could not be read. Upload it again.', '無法讀取相片，請重新上載。']],
  ['请选择一张小于 8 MB 的照片', ['Choose a photo smaller than 8 MB.', '請選擇小於 8 MB 的相片。']],
  ['请选择 8 MB 以内的图片。', ['Choose an image up to 8 MB.', '請選擇不超過 8 MB 的圖片。']],
  ['请输入有效的 HTTPS 来源链接', ['Enter a valid HTTPS source link.', '請輸入有效的 HTTPS 來源連結。']],
  ['请保留纪念页原有的宠物档案关联', ['Keep this memory page linked to its original pet profile.', '請保留紀念頁與原有寵物檔案的連結。']],
  ['请输入宠物的名字', ['Enter your pet’s name.', '請輸入寵物的名字。']],
  ['购买数量须为 1 至 99', ['Enter a quantity from 1 to 99.', '購買數量須為 1 至 99 件。']],
  ['商品不存在', ['This product could not be found.', '找不到這件商品。']],
  ['存在无效的商品规格', ['One or more product options are unavailable.', '有一項或多項商品款式無效。']],
  ['规格不属于该商品或重复提交', ['A product option was duplicated or belongs to another product.', '商品款式重複，或不屬於這件商品。']],
  ['库存已更新，请刷新商品后再保存', ['Stock has changed. Refresh the product before saving.', '庫存已更新，請重新整理商品後再儲存。']],
  ['请选择商品分类', ['Select a product category.', '請選擇商品分類。']],
  ['请使用站内商品图片或 HTTPS 图片地址', ['Use a store image or an HTTPS image address.', '請使用站內商品圖片或 HTTPS 圖片連結。']],
  ['商品须有 1 至 25 个规格', ['Provide between 1 and 25 product options.', '商品須有 1 至 25 個款式。']],
  ['商品价格或库存超出允许范围', ['The price or stock count is out of range.', '商品價格或庫存超出有效範圍。']],
  ['结算金额已变化，请刷新价格并重新确认', ['The total has changed. Refresh the quote and confirm it again.', '結帳金額已變動，請更新報價後重新確認。']],
  ['部分购物车商品已失效，请刷新后重新结算', ['Some items in your bag are unavailable. Refresh the bag before checking out.', '購物袋有部分商品已失效，請重新整理後再次結帳。']],
  ['请选择要购买的商品', ['Choose the items you want to buy.', '請選擇要購買的商品。']],
  ['当前环境尚未开放在线支付', ['Online payment is unavailable in this environment.', '此環境尚未開放網上付款。']],
  ['订单当前无法申请退款', ['A refund cannot be requested for this order right now.', '這張訂單目前無法申請退款。']],
  ['请选择退款处理结果', ['Choose how to resolve the refund request.', '請選擇退款處理結果。']],
  ['该运单号已关联其他订单商品', ['This tracking number is already linked to other order items.', '此運單號碼已連結其他訂單商品。']],
  ['订单当前无法发货', ['This order cannot be dispatched right now.', '這張訂單目前無法出貨。']],
  ['请只选择该订单中尚未发货的商品', ['Select only unshipped items from this order.', '只可選擇此訂單內尚未出貨的商品。']],
  ['请选择已经完成制作的定制品', ['Select personalised items that have finished production.', '請選擇已完成製作的訂製商品。']],
  ['请选择定制商品与制作状态', ['Select a personalised item and its production status.', '請選擇訂製商品及製作狀態。']],
  ['订单商品当前无法更新制作状态', ['The production status cannot be updated for this item right now.', '此訂單商品目前無法更新製作狀態。']],
  ['商品分类无效', ['This category is invalid.', '商品分類無效。']],
  ['购物车已满', ['Your shopping bag is full.', '購物袋已滿。']],
  ['该商品当前库存不足或已下架', ['This item is out of stock or no longer listed.', '此商品庫存不足或已下架。']],
  ['购物车商品不存在', ['This item is no longer in your bag.', '購物袋內已沒有這件商品。']],
  ['请选择有效的商品规格', ['Select a valid product option.', '請選擇有效的商品款式。']],
  ['该商品使用标准规格', ['This product has standard options.', '此商品使用標準款式。']],
  ['请填写定制文字或上传照片', ['Enter personalised text or upload a photo.', '請填寫訂製文字或上載相片。']],
  ['请检查提交内容的格式。', ['Check the format of the information you entered.', '請檢查已輸入資料的格式。']],
  ['请检查必填项及字段长度。', ['Check the required fields and their length limits.', '請檢查必填欄位及字數限制。']],
]);

export function localizeError(error: unknown, locale: Locale) {
  const message = error instanceof Error ? error.message : '';
  if (locale === 'zh-CN') return message || '暂时无法完成操作。';
  const index = locale === 'en' ? 0 : 1;
  const translated = messages.get(message)?.[index];
  if (translated) return translated;
  const stock = /^(.*?)库存不足，可购买 (\d+) 件$/.exec(message);
  if (stock) {
    const product = stock[1] ? `${localizeSeedText(stock[1], locale)} · ` : '';
    return product + (index === 0 ? `Only ${stock[2]} available.` : `僅餘 ${stock[2]} 件。`);
  }
  if (error instanceof ApiError) {
    if (error.status === 404) return index === 0 ? 'This item is no longer available.' : '此項目已無法存取。';
    if (error.status === 409) return index === 0 ? 'This item has changed. Refresh and try again.' : '此項目已更新。請重新整理後再試。';
    if (error.status === 401 || error.status === 403) return index === 0 ? 'Check your access and sign in again.' : '請確認你的權限並重新登入。';
    if (error.status < 500) return index === 0 ? 'Check what you entered, then try again.' : '請檢查輸入的資料後再試。';
  } else if (message && !/[\u3400-\u9fff]/.test(message) && message !== 'Failed to fetch') {
    return message;
  }
  return index === 0 ? 'The service is temporarily unavailable. Try again shortly.' : '服務暫時未能使用，請稍後再試。';
}

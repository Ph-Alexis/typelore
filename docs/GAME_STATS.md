# BẢNG THỐNG KÊ CHỈ SỐ & CƠ CHẾ TRẬN ĐẤU (TYPELORE GAME STATS)

Tài liệu này tổng hợp toàn bộ các chỉ số balance, cơ chế chiến đấu, sát thương, máu (HP), thời gian hồi chiêu (cooldown) và hệ thống lệnh trong game **Typelore**.

---

## 1. TỔNG QUAN HỆ THỐNG TRẬN ĐẤU (MATCH OVERVIEW)

| Thông số | Giá trị | Ghi chú |
| :--- | :--- | :--- |
| **Castle HP (Máu tường thành)** | **200 HP** | Máu tối đa của mỗi người chơi. Rơi về 0 sẽ thua cuộc. |
| **Kích thước sàn đấu (Grid)** | **3 × 3 (9 ô)** | Ô 1 đến 9 theo bàn phím Numpad. |
| **Tốc độ nhịp chiến đấu (Tick Rate)** | **1 giây (1000 ms)** | Mỗi giây là 1 lượt bắn của súng và 1 bước bay của chim. |
| **Đếm ngược trước trận** | **3 giây (3-2-1)** | Xuất hiện khi cả 2 người chơi sẵn sàng hoặc cùng bấm tái đấu. |
| **Điều kiện Chiến thắng** | Castle địch = 0 HP | Castle mình > 0 HP. |
| **Điều kiện Hòa cờ (Draw)** | Cả 2 Castle = 0 HP | Xảy ra khi cả 2 sụp đổ trong cùng 1 tick. |

### Sơ đồ vị trí các ô trên lưới (3x3 Grid Layout)
- **Hàng 1 (Hàng Trên):** Ô `7`, `8`, `9`
- **Hàng 2 (Hàng Giữa):** Ô `4`, `5`, `6`
- **Hàng 3 (Hàng Dưới):** Ô `1`, `2`, `3`

---

## 2. CHỈ SỐ CÔNG TRÌNH & CHIẾN ĐẤU MẶT ĐẤT (GROUND COMBAT)

### 2.1. Súng Lục (Pistol)
- **Lệnh:** `pistol <1-9>`
- **Máu (HP):** `15 HP`
- **Đạn ban đầu khi mới đặt:** `0 viên`
- **Sức chứa đạn tối đa:** `10 viên`
- **Tốc độ bắn:** `1 viên / giây` (mỗi combat tick sẽ tự động bắn 1 viên nếu có đạn).
- **Sát thương mỗi phát (Pistol Damage):** `5 HP`
- **Quy tắc bay của đạn:** 
  - Đạn bay thẳng theo hàng (Row).
  - Trúng vật thể đầu tiên của đối thủ trên hàng đó.
  - Nếu hàng đối thủ hoàn toàn trống, đạn bắn thẳng vào Castle đối phương, gây **5 sát thương**.

### 2.2. Nạp Đạn (Load Ammo)
- **Lệnh:** `load ammo <1-9>`
- **Số lượng nạp mỗi lần:** `+5 viên đạn` (tối đa chạm trần 10 viên).
- **Điều kiện:** Ô mục tiêu phải đang có Súng Lục (Pistol).

### 2.3. Khiên Chắn (Protector)
- **Lệnh:** `protector <1-9>`
- **Máu (HP):** `30 HP`
- **Tác dụng:** Làm bia đỡ đạn cho hàng đó, chặn đạn của Pistol đối phương bắn thẳng vào súng hoặc Castle phía sau.

### 2.4. Nước (Water) & Đất Sét (Clay)
- **Nước:**
  - **Lệnh:** `add water <1-9>`
  - **Máu (HP):** `5 HP`
- **Đất sét:**
  - **Lệnh:** `add clay <1-9>`
  - **Máu (HP):** `10 HP`
- **Cơ chế đúc Gạch (Crafting Brick):**
  - Đặt Nước lên ô đã có Đất Sét HOẶC đặt Đất Sét lên ô đã có Nước sẽ tự động hợp nhất thành **Gạch (Brick)** ngay lập tức.

### 2.5. Gạch (Brick) & Hồi Máu Castle (Use Brick)
- **Máu của khối Gạch:** `15 HP`
- **Lệnh sử dụng:** `use brick <1-9>`
- **Tác dụng hồi phục:** Tiêu hao khối gạch trên sân để hồi **+25 HP Castle** (tối đa 200 HP).

---

## 3. VŨ KHÍ HẠNG NẶNG & KHÔNG CHIẾN (HEAVY & AIR COMBAT)

### 3.1. Pháo Bazooka (Oanh Tạc Diện Rộng AoE)
- **Cú pháp lệnh:** `bazooka <A|B|C|D>` hoặc `bazooka <1|4>`
- **Phạm vi tác chiến (4 ô nổ lan):**
  - **Khu A (hoặc 1):** Ô `7, 8, 4, 5` (Góc trên - trái)
  - **Khu B (hoặc 2):** Ô `8, 9, 5, 6` (Góc trên - phải)
  - **Khu C (hoặc 3):** Ô `4, 5, 1, 2` (Góc dưới - trái)
  - **Khu D (hoặc 4):** Ô `5, 6, 2, 3` (Góc dưới - phải)
- **Sát thương (Bazooka Damage):** **10 sát thương** lên TẤT CẢ các vật thể trong 4 ô của khu vực nhắm bắn.
  - *Lưu ý:* Khiên Protector không thể chắn sát thương lan này cho các ô xung quanh; mọi vật thể trong vùng đều chịu 10 sát thương đồng thời.
  - Bazooka không gây sát thương lên Castle đối phương.
- **Thời gian hồi chiêu (Cooldown):** **60 giây** (1 phút).
- **Cơ chế bắt đầu trận:** **Bắt đầu tính cooldown 60s ngay khi vừa vào trận** (không sẵn sàng ngay).

### 3.2. Chim Ném Bom (Bombing Bird)
- **Cú pháp lệnh:** `bird and bomb`
- **Máu của chim (Bird HP):** `15 HP`
- **Thời gian bay (Flight Time):** **10 giây** (tương ứng 10 ticks bay).
- **Sát thương Castle (Bird Damage):** **20 sát thương** trực tiếp vào Castle đối thủ khi chim bay đến đích thành công.
- **Thời gian hồi chiêu (Cooldown):** **90 giây** (1.5 phút).
- **Cơ chế bắt đầu trận:** **Bắt đầu tính cooldown 90s ngay khi vừa vào trận** (không sẵn sàng ngay).
- **Tính độc lập:** Chim bay trên hành lang không chiến riêng biệt, không bị cản bởi vật thể trên lưới đất và không bị ảnh hưởng bởi pháo Bazooka.

### 3.3. Phòng Không Bắn Chim (Air Defense & Arrow)
- **Cơ chế:** Gõ chữ cái tiếng Anh hiển thị trên người chim hoặc dùng lệnh `arrow`.
- **Từ khóa thử thách:** Gồm **12 ký tự ngẫu nhiên** (a-z).
- **Sát thương mỗi mũi tên (Arrow Damage):** **5 HP / phát bắn**.
- **Số phát cần thiết để hạ gục:** **3 phát bắn** (3 chữ cái / mũi tên) sẽ tiêu diệt hoàn toàn con chim 15 HP giữa không trung, bảo toàn tuyệt đối 20 HP cho Castle.
- **Thứ tự ưu tiên mục tiêu:** Tự động nhắm vào con chim đang bay gần Castle của mình nhất (số tick còn lại ít nhất).

---

## 4. BẢNG TỔNG HỢP CÚ PHÁP LỆNH (COMMAND QUICK REFERENCE)

| Tên lệnh | Cú pháp | Mục tiêu | HP vật thể | Sát thương / Hồi máu | Cooldown |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pistol** | `pistol <1-9>` | Ô trên sân | 15 HP | 5 HP / viên (bắn thẳng) | Không |
| **Load Ammo** | `load ammo <1-9>` | Ô có Pistol | - | Nạp +5 đạn (tối đa 10) | Không |
| **Protector** | `protector <1-9>` | Ô trên sân | 30 HP | Chặn đạn hàng thẳng | Không |
| **Add Water** | `add water <1-9>` | Ô trên sân | 5 HP | Nguyên liệu đúc gạch | Không |
| **Add Clay** | `add clay <1-9>` | Ô trên sân | 10 HP | Nguyên liệu đúc gạch | Không |
| **Use Brick** | `use brick <1-9>` | Ô có Gạch | Tiêu hao gạch | **Hồi +25 HP Castle** | Không |
| **Bazooka** | `bazooka <A-D/1-4>` | Khu vực 4 ô | - | **10 sát thương** nổ lan | **60 giây** (tính từ đầu trận) |
| **Bird & Bomb** | `bird and bomb` | Castle đối thủ | 15 HP | **20 sát thương** Castle | **90 giây** (tính từ đầu trận) |
| **Arrow** | Gõ chữ / `arrow` | Chim địch | - | **5 sát thương** / mũi tên | Không (cần 3 hit để hạ chim) |

---

## 5. CHỈ SỐ THỐNG KÊ SAU TRẬN ĐẤU (MATCH METRICS)

Sau khi trận đấu kết thúc, hệ thống sẽ tự động tổng kết và hiển thị bảng chỉ số thi đấu:

1. **Thời lượng trận đấu (Duration):** Tính bằng giây từ lúc bắt đầu đến khi Castle sụp đổ.
2. **Tổng lệnh hợp lệ (Valid Commands):** Số lần ra lệnh chính xác và có hiệu lực.
3. **Lệnh gõ sai (Invalid Commands):** Số lần gõ sai cú pháp, sai ô hoặc lệnh bị từ chối do cooldown/hết đạn.
4. **Tổng số ký tự đã gõ (Characters Typed):** Thống kê tốc độ và khối lượng gõ phím.
5. **Sát thương từ Súng (Pistol Damage Dealt):** Tổng lượng sát thương từ các phát đạn Pistol.
6. **Sát thương từ Bazooka (Bazooka Damage Dealt):** Tổng sát thương diện rộng phá hủy vật thể địch.
7. **Số lần bắn Bazooka (Bazooka Fired):** Đếm số lần kích hoạt oanh kích.
8. **Thống kê Không chiến:**
   - Số chim đã thả (`Birds Launched`).
   - Số chim ném bom trúng thành công (`Birds Hit Castle`).
   - Số chim đối thủ bị mình bắn hạ (`Birds Shot Down`).
9. **Máu đã hồi cho Castle (HP Healed):** Tổng lượng máu Castle được hồi nhờ lệnh `use brick`.
10. **Sát thương Castle phải gánh chịu (Castle Damage Taken):** Tổng lượng máu mất đi trong suốt trận.


export interface TutorialStepDef {
  id: number;
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
  requiredCommand: string;
  hintVi: string;
  hintEn: string;
  targetCellId?: number;
  targetAreaId?: "A" | "B" | "C" | "D";
  isBirdDefense?: boolean;
}

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 1,
    titleVi: "Bước 1/11: Triển khai Súng Lục (Pistol)",
    titleEn: "Step 1/11: Deploy Pistol",
    descVi: "Súng lục là hỏa lực mặt đất cơ bản. Khi được đặt trên lưới và có đạn, súng sẽ tự động bắn đạn thẳng hàng sang chướng ngại vật và Lâu Đài đối thủ.",
    descEn: "Pistol is your primary ground firearm. Placed on a grid row with ammo, it fires straight along the row into opponent obstacles and castle.",
    requiredCommand: "pistol 4",
    hintVi: "Gõ lệnh: pistol 4 để đặt súng lục ở ô trung tâm hàng 2",
    hintEn: "Type command: pistol 4 to place pistol in center cell of Row 2",
    targetCellId: 4,
  },
  {
    id: 2,
    titleVi: "Bước 2/11: Nạp Đạn Cho Súng Lục (Load Ammo)",
    titleEn: "Step 2/11: Load Ammo to Pistol",
    descVi: "Súng mới đặt có 0 đạn. Dùng lệnh 'load ammo' để nạp +2 viên đạn. Khi có đạn, súng sẽ lập tức khai hỏa đạn bay thẳng qua hành lang tấn công đối thủ!",
    descEn: "Newly placed pistols have 0 ammo. Use 'load ammo' to add +2 bullets. With ammo loaded, the pistol immediately fires across the corridor!",
    requiredCommand: "load ammo 4",
    hintVi: "Gõ lệnh: load ammo 4 để nạp đạn cho súng ở ô 4",
    hintEn: "Type command: load ammo 4 to load ammo into pistol at cell 4",
    targetCellId: 4,
  },
  {
    id: 3,
    titleVi: "Bước 3/11: Dựng Khiên Bảo Vệ / Tanker (Protector)",
    titleEn: "Step 3/11: Deploy Protector (Tanker)",
    descVi: "Khiên Protector có 20 HP, đóng vai trò tanker chặn đứng toàn bộ đạn bắn thẳng từ đối phương, bảo vệ súng và Lâu Đài phía sau.",
    descEn: "Protector has 20 HP, acting as a tanker shield that blocks incoming enemy bullets from hitting your firearms and Castle.",
    requiredCommand: "protector 6",
    hintVi: "Gõ lệnh: protector 6 để dựng khiên phía trước súng lục",
    hintEn: "Type command: protector 6 to place shield in front of pistol",
    targetCellId: 6,
  },
  {
    id: 4,
    titleVi: "Bước 4/11: Thu thập Đất Sét (Add Clay)",
    titleEn: "Step 4/11: Harvest Clay Resource",
    descVi: "Đất sét (Clay - 10 HP) là 1 trong 2 nguyên liệu thiết yếu để chế tạo Gạch (Brick). Hãy đặt một khối Clay lên sân để tích lũy nguyên liệu.",
    descEn: "Clay (10 HP) is 1 of 2 essential ingredients to craft Bricks. Place Clay on your grid to store crafting resources.",
    requiredCommand: "add clay 7",
    hintVi: "Gõ lệnh: add clay 7 để đặt đất sét ở ô 7",
    hintEn: "Type command: add clay 7 to place clay at cell 7",
    targetCellId: 7,
  },
  {
    id: 5,
    titleVi: "Bước 5/11: Thu thập Nước (Add Water)",
    titleEn: "Step 5/11: Harvest Water Resource",
    descVi: "Nước (Water - 10 HP) kết hợp với Đất Sét sẽ tạo thành Gạch nung. Hãy đặt Nước lên sân để chuẩn bị chế tạo.",
    descEn: "Water (10 HP) combines with Clay to forge Bricks. Place Water on your grid to prepare for crafting.",
    requiredCommand: "add water 8",
    hintVi: "Gõ lệnh: add water 8 để đặt nước ở ô 8",
    hintEn: "Type command: add water 8 to place water at cell 8",
    targetCellId: 8,
  },
  {
    id: 6,
    titleVi: "Bước 6/11: Nung Gạch & Hồi Máu Thành (Use Brick)",
    titleEn: "Step 6/11: Craft Brick & Heal Castle",
    descVi: "Khi sở hữu đủ 1 Clay và 1 Water, lệnh 'use brick' sẽ tiêu thụ cả hai nguyên liệu để hồi phục ngay lập tức +15 HP cho Lâu Đài của bạn!",
    descEn: "With 1 Clay and 1 Water available, 'use brick' consumes both materials to immediately heal +15 HP for your Castle!",
    requiredCommand: "use brick",
    hintVi: "Gõ lệnh: use brick để đúc gạch hồi máu +15 HP",
    hintEn: "Type command: use brick to craft brick and heal +15 HP",
  },
  {
    id: 7,
    titleVi: "Bước 7/11: Đặt Tường Gạch Kiên Cố (Add Brick)",
    titleEn: "Step 7/11: Place Brick Obstacle Wall",
    descVi: "Bạn cũng có thể đúc gạch và đặt trực tiếp lên một ô lưới bằng lệnh 'add brick <ô>' (hoặc 'use brick <ô>') tạo vật cản kiên cố 20 HP.",
    descEn: "You can also forge a brick and place it directly on a cell with 'add brick <cell>' to create a durable 20 HP obstacle wall.",
    requiredCommand: "add brick 1",
    hintVi: "Gõ lệnh: add brick 1 để đặt tường gạch tại ô 1",
    hintEn: "Type command: add brick 1 to place brick obstacle at cell 1",
    targetCellId: 1,
  },
  {
    id: 8,
    titleVi: "Bước 8/11: Tích Năng Lượng Pháo Hạng Nặng (Boost)",
    titleEn: "Step 8/11: Charge Bazooka Boost",
    descVi: "Pháo Bazooka trên đỉnh tháp cần 10 nấc năng lượng để khai hỏa. Dùng lệnh 'boost' để tích lũy nấc sạc cho pháo.",
    descEn: "The heavy Bazooka atop the tower requires 10 boost charges to fire. Use 'boost' to charge its energy gauge.",
    requiredCommand: "boost",
    hintVi: "Gõ lệnh: boost để nạp năng lượng cho Bazooka",
    hintEn: "Type command: boost to charge Bazooka energy gauge",
  },
  {
    id: 9,
    titleVi: "Bước 9/11: Bắn Pháo Bazooka Oanh Tạc (Bazooka)",
    titleEn: "Step 9/11: Fire Bazooka AOE Strike",
    descVi: "Pháo đã sạc đầy 10/10! Lệnh 'bazooka <A-D>' phóng rocket oanh tạc toàn bộ 4 ô trong khu vực của đối thủ, gây 10 sát thương nổ lan quét sạch vật cản!",
    descEn: "Bazooka is fully charged! 'bazooka <A-D>' fires rockets into a 4-cell zone on the opponent's grid, dealing 10 AOE damage to clear obstacles!",
    requiredCommand: "bazooka B",
    hintVi: "Gõ lệnh: bazooka B để oanh tạc khu vực B của đối thủ",
    hintEn: "Type command: bazooka B to bomb Area B on opponent grid",
    targetAreaId: "B",
  },
  {
    id: 10,
    titleVi: "Bước 10/11: Thả Chim Ném Bom (Bird and Bomb)",
    titleEn: "Step 10/11: Launch Bombing Bird",
    descVi: "Lệnh 'bird and bomb' thả chim chiến đấu bay thẳng trên không sang Lâu Đài đối thủ gây 20 sát thương cực lớn! Sau khi thả, chim có thời gian hồi chiêu 1 phút.",
    descEn: "The 'bird and bomb' command launches a bird flying across the sky to strike opponent Castle for 20 damage! It has a 1-minute cooldown.",
    requiredCommand: "bird and bomb",
    hintVi: "Gõ lệnh: bird and bomb để thả chim ném bom",
    hintEn: "Type command: bird and bomb to launch bombing bird",
  },
  {
    id: 11,
    titleVi: "Bước 11/11: Phòng Thủ Không Quân (Bắn Hạ Chim Địch)",
    titleEn: "Step 11/11: Air Defense - Shoot Down Bird",
    descVi: "BÁO ĐỘNG! Bot vừa thả chim ném bom sang Lâu Đài của bạn! Hãy nhìn chuỗi 12 ký tự trên chim và GÕ CHÍNH XÁC từng chữ để bắn hạ nó trước khi chim chạm thành!",
    descEn: "ALERT! Bot launched a bombing bird at your Castle! Look at the 12 letters on the bird and TYPE THEM ACCURATELY to fire arrows and shoot it down!",
    requiredCommand: "",
    isBirdDefense: true,
    hintVi: "Gõ chính xác 12 chữ cái đang hiển thị trên Chim đối thủ",
    hintEn: "Type the exact 12 letters displayed on the enemy Bird",
  },
];

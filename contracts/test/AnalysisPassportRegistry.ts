import { expect } from "chai";
import { ethers } from "hardhat";

const k = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("AnalysisPassportRegistry", () => {
  async function deploy() {
    const [admin, other, registrar2] = await ethers.getSigners();
    const R = await ethers.getContractFactory("AnalysisPassportRegistry");
    const reg = await R.deploy(admin.address);
    return { reg, admin, other, registrar2 };
  }

  it("authorized registration succeeds and emits event", async () => {
    const { reg, admin } = await deploy();
    const c = k("commit");
    await expect(reg.register(k("p1"), k("proj"), c)).to.emit(reg, "PassportRegistered");
    const r = await reg.getRecord(k("p1"));
    expect(r.commitment).to.equal(c);
    expect(r.registrant).to.equal(admin.address);
    expect(await reg.passportKeyOf(c)).to.equal(k("p1"));
  });

  it("unauthorized registration reverts", async () => {
    const { reg, other } = await deploy();
    await expect(reg.connect(other).register(k("p"), k("x"), k("c"))).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
  });

  it("rejects empty and duplicate values", async () => {
    const { reg } = await deploy();
    await expect(reg.register(k("p"), k("x"), ethers.ZeroHash)).to.be.revertedWithCustomError(reg, "EmptyValue");
    await reg.register(k("p"), k("x"), k("c"));
    await expect(reg.register(k("p"), k("x"), k("c2"))).to.be.revertedWithCustomError(reg, "AlreadyRegistered");
    await expect(reg.register(k("p2"), k("x"), k("c"))).to.be.revertedWithCustomError(reg, "CommitmentAlreadyUsed");
  });

  it("admin can grant and revoke registrars; others cannot", async () => {
    const { reg, other, registrar2 } = await deploy();
    const role = await reg.REGISTRAR_ROLE();
    await expect(reg.connect(other).grantRole(role, other.address)).to.be.reverted;
    await reg.grantRole(role, registrar2.address);
    await reg.connect(registrar2).register(k("a"), k("x"), k("c"));
    await reg.revokeRole(role, registrar2.address);
    expect(await reg.isRegistrar(registrar2.address)).to.equal(false);
    await expect(reg.connect(registrar2).register(k("b"), k("x"), k("d"))).to.be.reverted;
    // Historical record stays readable after revocation.
    expect((await reg.getRecord(k("a"))).registrant).to.equal(registrar2.address);
  });
});
